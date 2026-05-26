# Viajero — Fluxo E2E no Insomnia

Roteiro passo-a-passo pra exercitar todas as features do backend usando a coleção `insomnia-viajero.json`, do cadastro até roteiro gerado com IA + auditoria. Marca **🤖** = ponto onde Gemini/Groq é acionado. **🕷️** = ponto onde Firecrawl é acionado.

Ambiente do Insomnia padrão: `base_url = http://127.0.0.1:8000`. Variáveis usadas: `jwt`, `destination_id`, `itinerary_id`, `traveler_dna_id`, `trip_preference_id`, `favorite_id`, `review_id`, `shared_link_id`.

---

## Bloco 0 — Setup do ambiente

### 0.1 Banco de dados

**Opção A — Postgres via Docker:**

```bash
docker run -d \
  --name viajero-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=1414 \
  -e POSTGRES_DB=viajero \
  -p 5432:5432 \
  -v viajero-pgdata:/var/lib/postgresql/data \
  postgres:16
```

Parar/retomar depois: `docker stop viajero-pg` / `docker start viajero-pg`.

**Opção B — SQLite (zero dependência externa):** pula o `docker run` e usa `DATABASE_URL=sqlite:///./db.sqlite3` no `.env`.

### 0.2 `.env` mínimo (`backend/.env`)

```env
DJANGO_SECRET_KEY=change-me
DATABASE_URL=postgresql://postgres:1414@localhost:5432/viajero
DEBUG=true
ALLOWED_HOSTS=*
JWT_SECRET_KEY=change-me-too

# Firecrawl
FIRECRAWL_API_KEY=fc-xxxxx
FIRECRAWL_API_URL=https://api.firecrawl.dev/v1
FIRECRAWL_SEARCH_TIMEOUT=20
FIRECRAWL_SCRAPE_TIMEOUT=45
FIRECRAWL_CONNECT_TIMEOUT=10

# IA — Gemini primário
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza-xxxxx
GEMINI_MODEL=gemini-2.0-flash

# IA — Groq fallback
GROQ_API_KEY=gsk_xxxxx
GROQ_MODEL=llama-3.3-70b-versatile
```

### 0.3 Subir o backend

```bash
cd backend
uv sync                                  # instala dependências (primeira vez)
uv run manage.py migrate                 # aplica schema
uv run manage.py loaddata seed_data.json # popula destinos/POIs/templates iniciais
uv run manage.py createsuperuser         # opcional, pra acessar admin/audit
uv run manage.py runserver               # http://127.0.0.1:8000
```


### 0.4 Importar a coleção no Insomnia

`Application → Import/Export → Import Data → From File → insomnia-viajero.json` (raiz do repo).

### 0.5 Sanity checks rápidos

```bash
# backend respondendo
curl -s http://127.0.0.1:8000/api/destinations/ -o /dev/null -w "%{http_code}\n"
# 401 (sem token) = ok; 200 (com token) = ok; connection refused = server não subiu

# Postgres conectando
cd backend && uv run manage.py dbshell -c "SELECT 1;"

# testes passando (sem queimar crédito de API)
uv run pytest tests/ -v
```

---

## Bloco 1 — Conta e sessão

| Nº | Pasta → Request | Método | Resultado esperado |
|---|---|---|---|
| 1 | **Auth → Register** | POST `/api/auth/register/` | 201 + `{access, refresh, user}` |
| 2 | **Auth → Login** | POST `/api/auth/login/` | 200 + `{access, refresh}`. **Copie `data.access` para o env `jwt`**. |
| 3 | **Users → Me (GET)** | GET `/api/users/me/` | 200 com o usuário autenticado (valida o token). |
| 4 | **Users → Me (PATCH)** | PATCH `/api/users/me/` | atualiza `display_name`, `home_airport`, `preferred_currency`. Marca `is_profile_complete=true`. |

---

## Bloco 2 — Perfil do viajante (alimenta a IA do roteiro)

Sem esses dados, o gerador cai em valores genéricos.

| Nº | Pasta → Request | Método | Body chave |
|---|---|---|---|
| 5 | **Traveler DNA → Create (POST)** | POST `/api/traveler-dna/` | escalas 1–10: `travel_style`, `pace`, `comfort_level`, `social_energy`, `adventure_level`, `food_focus`, `cultural_interest`, `nature_interest`, `nightlife_interest`. Copie `id` retornado pra `traveler_dna_id`. |
| 6 | **Traveler DNA → Retrieve (GET)** | GET `/api/traveler-dna/{{ traveler_dna_id }}/` | confere persistência. |
| 7 | **Trip Preferences → Create (POST)** | POST `/api/trip-preferences/` | `budget_min/max`, `preferred_trip_length` (1–60), `travel_month`, `hotel_level`, `transportation_style`, `dietary_preferences`, `accessibility_needs`, `interests` (JSON). Copie `id` pra `trip_preference_id`. |

---

## Bloco 3 — Descoberta de destino (🕷️🤖)

A request **Search** dispara cache-aside: tenta DB local; se vazia, chama Firecrawl `/search`+`/scrape` em paralelo com o LLM enricher (Gemini com fallback Groq).

| Nº | Pasta → Request | Método | Notas |
|---|---|---|---|
| 8 | **Destinations → Search (GET)** | GET `/api/destinations/search/?q=Sorocaba` | 🕷️🤖 1ª chamada: 5–40s (Firecrawl + LLM rodando em paralelo). 2ª chamada com mesma query: cache hit instantâneo. Copie `data[0].id` pra `destination_id`. |
| 9 | **Destinations → Retrieve (GET)** | GET `/api/destinations/{{ destination_id }}/` | confere `summary`, `pois[]` (com `metadata.source` indicando origem), `cost_profile`, `metadata.sources` (qual provider contribuiu), `metadata.llm_source` (`gemini`/`groq`/``). |
| 10 | **Destinations → List (GET)** | GET `/api/destinations/` | lista paginada com o novo destino + seed. |
| 11 | **POIs → List (GET)** | GET `/api/pois/?destination={{ destination_id }}` | POIs do destino. Filtros opcionais: `poi_type`, `tags__slug`. |
| 12 | **POIs → Retrieve (GET)** | GET `/api/pois/{{ poi_id }}/` | detalhe do POI. |

---

## Bloco 4 — Roteiro gerado com IA (🤖)

| Nº | Pasta → Request | Método | Body chave |
|---|---|---|---|
| 13 | **Itineraries → Create (POST)** | POST `/api/itineraries/` | `{"destination": <destination_id>, "title": "Sorocaba 3 dias", "duration_days": 3, "start_date": "2026-06-01", "end_date": "2026-06-03", "currency_code": "BRL"}`. Copie `id` pra `itinerary_id`. Status inicial = `draft`. |
| 14 | **Itineraries → Retrieve (GET)** | GET `/api/itineraries/{{ itinerary_id }}/` | confere `generation_status=draft`. |
| 15 | **Itineraries → Generate (POST)** | POST `/api/itineraries/{{ itinerary_id }}/generate/` | 🤖 202 + status `generating`. Roda síncrono mas responde 202 (10–40s pra Llama 3.3 70B no Groq, similar no Gemini). |
| 16 | **Itineraries → Retrieve (GET)** | GET `/api/itineraries/{{ itinerary_id }}/` | espera `generation_status=ready`, `summary` populado, `budget_total` calculado. |
| 17 | **Itineraries → Days List (GET)** | GET `/api/itineraries/{{ itinerary_id }}/days/` | dias com eventos gerados pelo LLM. |
| 18 | **Itineraries → Day Detail (GET)** | GET `/api/itineraries/{{ itinerary_id }}/days/1/` | eventos do dia 1 com horário, FK opcional pra POI, `estimated_cost`. |
| 19 | **Itineraries → Update (PATCH)** | PATCH `/api/itineraries/{{ itinerary_id }}/` | altera título/descrição manualmente. |

---

## Bloco 5 — Engagement

| Nº | Pasta → Request | Método | Body |
|---|---|---|---|
| 20 | **Favorites → Create (POST)** | POST `/api/favorites/` | `{"itinerary": <itinerary_id>}`. Copie `id` pra `favorite_id`. |
| 21 | **Favorites → List (GET)** | GET `/api/favorites/` | só os do usuário logado. |
| 22 | **Reviews → Create (POST)** | POST `/api/reviews/` | `{"itinerary": <itinerary_id>, "rating": 5, "title": "...", "body": "..."}`. Copie `id` pra `review_id`. Atualiza `ReviewStat` automaticamente. |
| 23 | **Reviews → List (GET)** | GET `/api/reviews/?itinerary={{ itinerary_id }}` | reviews do roteiro. |
| 24 | **Shared Links → Create (POST)** | POST `/api/shared-links/` | `{"itinerary": <itinerary_id>, "expires_at": "2026-12-31T23:59:59Z"}`. Copie `id` pra `shared_link_id`. Gera token UUID em `data.token`. |
| 25 | **Shared Links → List (GET)** | GET `/api/shared-links/` | links do usuário. |

---

## Bloco 6 — Endpoints públicos da home (AllowAny — sem JWT)

| Nº | Pasta → Request | Método | Notas |
|---|---|---|---|
| 26 | **Itineraries → Templates (GET)** | GET `/api/itineraries/templates/` | itinerários com `metadata.is_template=true` e `generation_status=ready`. |
| 27 | **Itineraries → Top Rated (GET)** | GET `/api/itineraries/top-rated/` | ranking por `ReviewStat.average_rating` desc. Após step 22, o seu roteiro deve aparecer. |

---

## Bloco 7 — Admin (requer superuser)

```bash
uv run manage.py createsuperuser
```

Relogar no Insomnia pra trocar o `jwt` pelo token de admin.

| Nº | Pasta → Request | Método | Notas |
|---|---|---|---|
| 28 | **Audit Logs → List (GET)** | GET `/api/audit-logs/` | espera eventos `firecrawl.discovered`, `itinerary.generated`, `favorite.created`, `review.created`, `shared_link.created`. Filtros: `event_type`, `content_type`. |
| 29 | **LLM Jobs → List (GET)** | GET `/api/llm-jobs/` | jobs do gerador. Confere `status=completed`, `response_payload`, `llm_model`. |
| 30 | **LLM Jobs → Retrieve (GET)** | GET `/api/llm-jobs/{{ llm_job_id }}/` | detalhe com `LLMJobLog`. |
| 31 | **LLM Models → List (GET)** | GET `/api/llm-models/` | modelos ativos cadastrados (Gemini, mock). |
| 32 | **Prompt Templates → List (GET)** | GET `/api/prompt-templates/` | templates `itinerary-generation`, etc. |
| 33 | **Integrations → Firecrawl Ingest (POST)** | POST `/api/firecrawl/ingest/` | 🕷️ ingestão manual com `{destination_id, source_urls[]}` específicas. Útil pra enriquecer um destino existente com URLs curadas. |

---

## Bloco 8 — Cleanup (opcional)

| Nº | Pasta → Request | Método |
|---|---|---|
| 34 | **Shared Links → Delete** | DELETE `/api/shared-links/{{ shared_link_id }}/` |
| 35 | **Reviews → Delete** | DELETE `/api/reviews/{{ review_id }}/` |
| 36 | **Favorites → Delete** | DELETE `/api/favorites/{{ favorite_id }}/` |
| 37 | **Itineraries → Delete** | DELETE `/api/itineraries/{{ itinerary_id }}/` |
| 38 | **Trip Preferences → Delete** | DELETE `/api/trip-preferences/{{ trip_preference_id }}/` |
| 39 | **Traveler DNA → Delete** | DELETE `/api/traveler-dna/{{ traveler_dna_id }}/` |
| 40 | **Auth → Logout** | POST `/api/auth/logout/` |

---

## Variáveis do environment (preenche conforme avança)

| Var | Origem | Quando |
|---|---|---|
| `jwt` | `data.access` do Login | passo 2 |
| `user_id` | `data.user.id` do Register/Login | passo 1 ou 2 |
| `traveler_dna_id` | `data.id` do Create | passo 5 |
| `trip_preference_id` | `data.id` do Create | passo 7 |
| `destination_id` | `data[0].id` do Search | passo 8 |
| `poi_id` | algum POI da listagem | passo 11 |
| `itinerary_id` | `data.id` do Create | passo 13 |
| `favorite_id` | `data.id` do Create | passo 20 |
| `review_id` | `data.id` do Create | passo 22 |
| `shared_link_id` | `data.id` do Create | passo 24 |
| `llm_job_id` | `data[0].id` do List | passo 29 |
| `audit_log_id` | `data[0].id` do List | passo 28 |

---

## Diagnóstico rápido

| Sintoma | Causa provável | Fix |
|---|---|---|
| 401 em rota protegida | token expirou / não setou `jwt` | refaça Login (passo 2) e atualize env |
| Search demora 30s+ na 1ª chamada | normal (Firecrawl scrape) | aguarde; 2ª chamada é cache hit |
| Search volta `data: []` | Firecrawl + LLM falharam ambos | confere logs do server; tente outra query |
| Generate volta `failed` | LLM com quota/timeout | confere `LLMJob.error_message`; troca `GEMINI_MODEL` ou ativa `GROQ_API_KEY` |
| `metadata.llm_source = ""` | nem Gemini nem Groq tinham key/respostas | só Firecrawl entregou dados |
| Cache negativo bloqueia retry | `FIRECRAWL_DISCOVERY_FAILURE_TTL=60s` | espera 60s ou muda query |

---

## Snapshot de status (referência rápida)

```
Itinerary.generation_status:
  draft       → criado, sem geração disparada
  generating  → /generate/ em andamento (ou parou no meio)
  ready       → LLM concluiu, dias populados
  failed      → erro persistido em LLMJob.error_message
```

```
Destination.metadata.sources:
  {"firecrawl": bool, "gemini": bool, "groq": bool}
  → indica qual provider contribuiu com dados
```
