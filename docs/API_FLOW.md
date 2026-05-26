# Viajero — Fluxo completo da aplicação

Guia prático pra disparar todas as rotas do backend, incluindo os pontos onde a **IA (Gemini)** entra. Pensa neste documento como o passo-a-passo de um usuário do zero até ter um roteiro gerado por IA na tela.

> **🤖 Marca de IA:** todas as etapas marcadas com 🤖 são pontos onde o Gemini é acionado (direta ou indiretamente).

---

## 0. Setup do ambiente

### 0.1 Configurar o `.env`

No `backend/.env` (não commitado), tenha pelo menos:

```env
# Banco e Django
DJANGO_SECRET_KEY=algum-segredo
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viajero
DEBUG=true
ALLOWED_HOSTS=*
CORS_ALLOW_ALL_ORIGINS=true
JWT_SECRET_KEY=outro-segredo

# Firecrawl (busca real de destinos)
FIRECRAWL_API_KEY=fc-xxxxx
FIRECRAWL_API_URL=https://api.firecrawl.dev/v1
FIRECRAWL_SCRAPE_TIMEOUT=25
FIRECRAWL_DISCOVERY_FAILURE_TTL=60

# 🤖 Gemini (geração de roteiro + fallback de destino)
DEFAULT_LLM_PROVIDER=gemini       # ← chave pra ativar o Gemini real
GEMINI_API_KEY=AIzaSy...           # sua chave do Google AI Studio
GEMINI_MODEL=gemini-2.0-flash
GEMINI_TIMEOUT=20
GEMINI_ITINERARY_TIMEOUT=40
```

Se `DEFAULT_LLM_PROVIDER` ficar como `mock` (ou `GEMINI_API_KEY` ficar vazia), o sistema cai pro `MockItineraryGenerator` e o enricher Gemini não dispara — útil pra dev/CI sem gastar tokens.

### 0.2 Subir o servidor

```bash
cd backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver  # http://localhost:8000
```

### 0.3 (Opcional) Seedar destinos populares

```bash
.venv/bin/python manage.py seed_destinations
# Cria 20 cidades brasileiras famosas no banco. Cada cidade pode disparar
# 🤖 Gemini se o Firecrawl não bastar.
```

---

## 1. Autenticação

| # | Método | Rota | Auth | Body / Query |
|---|---|---|---|---|
| 1.1 | POST | `/api/auth/register/` | – | `{email, password, password_confirm, display_name?}` |
| 1.2 | POST | `/api/auth/login/` | – | `{email, password}` |
| 1.3 | POST | `/api/auth/logout/` | Bearer | `{refresh}` (token) |

### 1.1 Cadastro

```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "davi@example.com",
    "password": "MinhaSenh@123",
    "password_confirm": "MinhaSenh@123",
    "display_name": "Davi"
  }'
```

Resposta (envelope `StandardResponseMixin`):

```json
{
  "success": true,
  "message": "Conta criada com sucesso.",
  "data": {
    "user": { "id": 1, "email": "davi@example.com", ... },
    "access": "eyJhbGc...",
    "refresh": "eyJhbGc..."
  }
}
```

Guarde `access` (Bearer token) e `refresh`.

### 1.2 Login

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "davi@example.com", "password": "MinhaSenh@123"}'
```

Mesma resposta da 1.1.

---

## 2. Perfil e onboarding

A partir daqui, todas as requests precisam do header `Authorization: Bearer <access>`. Vou abreviar como `$AUTH`.

```bash
AUTH="Authorization: Bearer eyJhbGc..."
```

### 2.1 Dados do usuário logado

| Método | Rota | Função |
|---|---|---|
| GET | `/api/users/me/` | Lê o usuário autenticado |
| PATCH | `/api/users/me/` | Atualiza `display_name`, `avatar_url`, `home_airport`, `preferred_currency` |

```bash
curl -X PATCH http://localhost:8000/api/users/me/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"home_airport": "GRU", "preferred_currency": "BRL"}'
```

### 2.2 Traveler DNA (estilo de viagem)

| Método | Rota | Função |
|---|---|---|
| POST | `/api/traveler-dna/` | Cria perfil de viagem (escalas 1–10) |
| GET | `/api/traveler-dna/` | Lista (filtrado pelo usuário) |
| PATCH | `/api/traveler-dna/{id}/` | Atualiza |

```bash
curl -X POST http://localhost:8000/api/traveler-dna/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "travel_style": "cultural",
    "pace": "balanced",
    "comfort_level": 7,
    "social_energy": 6,
    "adventure_level": 5,
    "food_focus": 9,
    "cultural_interest": 9,
    "nature_interest": 6,
    "nightlife_interest": 4
  }'
```

> Esses campos alimentam o prompt do 🤖 **Gemini** na geração do roteiro (5.2).

### 2.3 Preferências de viagem

| Método | Rota | Função |
|---|---|---|
| POST | `/api/trip-preferences/` | Cria preferências (orçamento, duração média, etc) |
| GET | `/api/trip-preferences/` | Lista |
| PATCH | `/api/trip-preferences/{id}/` | Atualiza |

```bash
curl -X POST http://localhost:8000/api/trip-preferences/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "budget_min": "1500",
    "budget_max": "4000",
    "preferred_trip_length": 5,
    "travel_month": 7,
    "hotel_level": "boutique",
    "transportation_style": "mixed",
    "interests": ["gastronomia", "arquitetura"]
  }'
```

> Também entra no prompt do 🤖 **Gemini** em 5.2.

---

## 3. Buscar destinos 🤖

A busca tem dois caminhos:

1. **Cache hit local** — se o destino já existe no DB, retorna direto.
2. **Cache miss** — dispara `DestinationDiscoveryService` que **roda Firecrawl + Gemini em paralelo** via `ThreadPoolExecutor`, funde resultados (Firecrawl é factual e ganha em conflito; Gemini complementa lacunas com summary e POIs textuais sem URLs) e persiste.

### 3.1 Buscar destino (pública, sem auth)

| Método | Rota | Query |
|---|---|---|
| GET | `/api/destinations/search/` | `?q=<cidade>&country=<opcional>&city=<opcional>` |

```bash
# Caso comum: cidade conhecida — pode acionar 🤖 Gemini complementar
curl "http://localhost:8000/api/destinations/search/?q=Florianopolis"

# Cidade pequena — Firecrawl pode falhar, 🤖 Gemini entra como fallback
curl "http://localhost:8000/api/destinations/search/?q=Iracemapolis"
```

Resposta típica (cache miss + descoberta com sucesso):

```json
{
  "success": true,
  "message": "Resultados carregados (destino enriquecido).",
  "data": [
    {
      "id": 12,
      "slug": "florianopolis",
      "name": "Florianópolis",
      "country": "Brasil",
      "summary": "...",
      "hero_image_url": "https://...",
      "pois": [
        { "name": "Praia da Joaquina", "poi_type": "attraction", "metadata": {} },
        { "name": "Mercado Público", "poi_type": "restaurant", "metadata": {"source": "gemini"} }
      ],
      "metadata": {
        "sources": { "firecrawl": true, "gemini": true },
        "gemini_model": "gemini-2.0-flash",
        "source_urls": ["https://..."]
      }
    }
  ]
}
```

> **🤖 Trigger:** olha `metadata.sources` na resposta. Se `gemini=true`, Gemini contribuiu. POIs com `metadata.source='gemini'` foram gerados por IA.

### 3.2 Listar/detalhar destinos (cache local apenas)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/destinations/` | Lista paginada |
| GET | `/api/destinations/{id}/` | Detalhe (com POIs) |

### 3.3 Listar POIs

| Método | Rota | Query |
|---|---|---|
| GET | `/api/pois/` | `?destination=<id>&poi_type=attraction&tags__slug=natureza` |
| GET | `/api/pois/{id}/` | Detalhe |

---

## 4. Criar o roteiro (envelope)

O roteiro tem 2 fases: **criar o envelope** (envia metadados básicos) e **gerar o conteúdo via IA** (5.2).

### 4.1 Criar itinerário

| Método | Rota | Body |
|---|---|---|
| POST | `/api/itineraries/` | `{destination, title, duration_days, budget_total, start_date?, end_date?, currency_code?}` |

```bash
curl -X POST http://localhost:8000/api/itineraries/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "destination": 12,
    "title": "Floripa Cultural 5 dias",
    "duration_days": 5,
    "budget_total": "2000.00",
    "currency_code": "BRL"
  }'
```

Resposta:

```json
{
  "success": true,
  "data": {
    "id": 7,
    "generation_status": "draft",   // ← ainda não foi gerado
    "destination": 12,
    "duration_days": 5,
    "days": []                       // ← vazio até gerar
  }
}
```

---

## 5. Gerar o roteiro 🤖🤖🤖

**Esse é o ponto principal da IA.** O endpoint chama `ItineraryGenerationService.run_job` que:

1. Cria um `LLMJob` (auditoria).
2. Lê `TravelerDNAProfile` + `UserTripPreference` do usuário (se existirem).
3. Lê os POIs do destino (ranqueados por rating, top 30).
4. Monta o prompt e chama o **Gemini** (ou MockGenerator se `DEFAULT_LLM_PROVIDER!=gemini`).
5. Valida `poi_id` retornado contra o DB.
6. Persiste `ItineraryDay` + `ItineraryDailyEvent` (FK pra POI quando válido).
7. Marca `Itinerary.generation_status='ready'`.

### 5.1 Disparar geração

| Método | Rota | Body |
|---|---|---|
| POST | `/api/itineraries/{id}/generate/` | (vazio) |

```bash
curl -X POST http://localhost:8000/api/itineraries/7/generate/ \
  -H "$AUTH"
```

**Síncrono** — espera ~5-15s (varia com `duration_days`). Resposta:

```json
{
  "success": true,
  "message": "Geracao de itinerario iniciada.",
  "data": {
    "id": 7,
    "generation_status": "ready",
    "title": "Floripa Cultural 5 dias",
    "summary": "Imersão cultural...",
    "budget_total": "1850.00",
    "days": [ /* 5 dias com eventos */ ]
  }
}
```

> Se der erro 503 → `LLMTimeoutError` ou `LLMQuotaError` do Gemini. `generation_status` vira `failed`. Veja `LLMJob.error_message` pra debug.

### 5.2 Ver os dias do roteiro

| Método | Rota | Função |
|---|---|---|
| GET | `/api/itineraries/{id}/days/` | Todos os dias com eventos |
| GET | `/api/itineraries/{id}/days/{n}/` | Dia específico |

```bash
curl "http://localhost:8000/api/itineraries/7/days/" -H "$AUTH"
curl "http://localhost:8000/api/itineraries/7/days/1/" -H "$AUTH"
```

Cada `event` tem:

```json
{
  "poi": 17,                       // FK pro PointOfInterest (null se freestyle)
  "title": "Almoço no Mercado Público",
  "description": "...",
  "estimated_cost": "65.00",
  "start_time": "12:30",
  "order_index": 2
}
```

### 5.3 Auditoria do job de IA

| Método | Rota | Função |
|---|---|---|
| GET | `/api/llm-jobs/` | Lista jobs do usuário (com `request_payload` e `response_payload`) |
| GET | `/api/llm-jobs/{id}/` | Detalhe + logs (`LLMJobLog`) |

Útil pra debugar quando o Gemini falhar — `request_payload` mostra exatamente o que foi enviado, `response_payload` o que voltou, e `error_message` o que deu errado.

---

## 6. Templates e ranking (home pública)

### 6.1 Templates genéricos (AllowAny)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/itineraries/templates/` | Roteiros marcados com `metadata.is_template=true` |

```bash
curl http://localhost:8000/api/itineraries/templates/
```

Pra "users novos" sem profile/preferences ainda — mostra exemplos curados na home.

### 6.2 Top avaliados (AllowAny)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/itineraries/top-rated/` | Roteiros `ready` com reviews, ordenados por rating |

```bash
curl http://localhost:8000/api/itineraries/top-rated/
```

---

## 7. Favoritar, avaliar, compartilhar

### 7.1 Favoritar

```bash
curl -X POST http://localhost:8000/api/favorites/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"itinerary": 7}'
```

### 7.2 Avaliar

```bash
curl -X POST http://localhost:8000/api/reviews/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"itinerary": 7, "rating": 5, "title": "Top!", "body": "Adoramos."}'
```

Atualiza automaticamente `ReviewStat.average_rating` e `review_count` do itinerário.

### 7.3 Compartilhar

```bash
# Cria link de compartilhamento (token UUID)
curl -X POST http://localhost:8000/api/shared-links/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"itinerary": 7}'

# Resposta inclui token. Frontend monta URL pública com ele.
```

---

## 8. Admin / observabilidade

### 8.1 Ingerir destino via Firecrawl (admin)

| Método | Rota | Auth |
|---|---|---|
| POST | `/api/firecrawl/ingest/` | `IsAdminUser` |

```bash
curl -X POST http://localhost:8000/api/firecrawl/ingest/ \
  -H "$AUTH_ADMIN" -H "Content-Type: application/json" \
  -d '{"destination_id": 12, "source_urls": ["https://..."]}'
```

Não dispara Gemini — só Firecrawl em URLs explícitas.

### 8.2 Audit logs

| Método | Rota | Auth |
|---|---|---|
| GET | `/api/audit-logs/` | `IsAdminUser` |

Lista todos os eventos auditados: `auth.registered`, `itinerary.created`, `itinerary.generated`, `destination.discovered` (com `metadata.sources`), etc.

### 8.3 Models e templates de prompt

| Método | Rota | Auth |
|---|---|---|
| GET | `/api/llm-models/` | Autenticado |
| GET | `/api/prompt-templates/` | `IsAdminUser` |

---

## Fluxo end-to-end típico (do zero ao roteiro)

```
1. POST /api/auth/register/               → cria conta, salva tokens
2. POST /api/traveler-dna/                → cria perfil de estilo
3. POST /api/trip-preferences/            → orçamento, datas, etc
4. GET  /api/destinations/search/?q=...   🤖 (Firecrawl + Gemini em paralelo)
5. POST /api/itineraries/                 → cria envelope (status=draft)
6. POST /api/itineraries/{id}/generate/   🤖 (Gemini gera dias + eventos)
7. GET  /api/itineraries/{id}/days/       → lê o roteiro pronto
8. POST /api/reviews/                     → avalia (opcional)
9. POST /api/shared-links/                → compartilha (opcional)
```

**Tempo total (com Gemini real):** ~30-60s da criação do envelope até roteiro completo.

---

## Como verificar que o Gemini está ativo

### Check 1: variáveis de ambiente

```bash
.venv/bin/python -c "from django.conf import settings; import django, os; \
  os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.dev'); \
  django.setup(); \
  print('Provider:', settings.DEFAULT_LLM_PROVIDER); \
  print('Key:', 'SET' if settings.GEMINI_API_KEY else 'EMPTY'); \
  print('Model:', settings.GEMINI_MODEL)"
```

Esperado:

```
Provider: gemini
Key: SET
Model: gemini-2.0-flash
```

### Check 2: smoke test de busca

```bash
curl -s "http://localhost:8000/api/destinations/search/?q=NomeQualquerCidade" | python -m json.tool
```

Procure `metadata.sources.gemini == true` no JSON.

### Check 3: smoke test de roteiro

```bash
# Cria itinerário (precisa de token + destination válido)
ITID=$(curl -s -X POST http://localhost:8000/api/itineraries/ \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"destination": 12, "duration_days": 3, "budget_total": "1000"}' \
  | python -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

# Dispara geração
curl -X POST "http://localhost:8000/api/itineraries/$ITID/generate/" -H "$AUTH"

# Confirma que metadata.generator == 'gemini'
curl -s "http://localhost:8000/api/itineraries/$ITID/" -H "$AUTH" \
  | python -c "import sys, json; d=json.load(sys.stdin)['data']; \
    print('status:', d['generation_status']); \
    print('generator:', d.get('generation_context', {}).get('generator'))"
```

Esperado: `status: ready`, `generator: gemini`.

---

## Troubleshooting

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| `generation_status` fica em `generating` | Gemini timeout (>40s) ou erro | `LLMJob.error_message` via `/api/llm-jobs/` |
| `data: []` na busca de cidade | Firecrawl + Gemini ambos falharam | Logs do Django (`logger.exception`) + cache negativo de 60s |
| 503 em `/generate/` | `LLMTimeoutError` ou `LLMQuotaError` | `LLMJob` mostra mensagem |
| POIs com FK null no roteiro | Gemini referenciou `poi_id` inexistente (descartado) | Logs `Gemini referenciou poi_id=X invalido` |
| `metadata.sources.gemini` sempre `false` | `GEMINI_API_KEY` vazio ou `DEFAULT_LLM_PROVIDER!=gemini` | `.env` |

---

## Referência rápida das rotas (todas)

```
# Pública
POST /api/auth/register/
POST /api/auth/login/
GET  /api/destinations/search/?q=...           🤖
GET  /api/itineraries/templates/
GET  /api/itineraries/top-rated/

# Usuário autenticado
GET/PATCH  /api/users/me/
POST/GET/PATCH  /api/traveler-dna/
POST/GET/PATCH  /api/trip-preferences/
GET/POST/PATCH/DELETE  /api/destinations/
GET  /api/pois/
POST/GET/PATCH/DELETE  /api/itineraries/
POST /api/itineraries/{id}/generate/           🤖
GET  /api/itineraries/{id}/days/
GET  /api/itineraries/{id}/days/{n}/
POST/GET/DELETE  /api/favorites/
POST/GET  /api/reviews/
POST/GET/DELETE  /api/shared-links/
GET  /api/llm-jobs/                            # auditoria das chamadas IA
POST /api/auth/logout/

# Admin
POST /api/firecrawl/ingest/
GET  /api/audit-logs/
GET  /api/prompt-templates/
GET  /api/llm-models/
```
