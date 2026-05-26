# Viajero — Documentação de Módulos e Controllers

Documento descrevendo a responsabilidade de cada app Django do backend e o que cada controller (view/viewset) expõe.

Todas as rotas são prefixadas por `/api/` e registradas via `DefaultRouter` do DRF.

---

## `apps/common` — Utilitários compartilhados

Fornece mixins reutilizados pelos demais apps para padronizar resposta de API.

- **StandardResponseMixin** — envelopa toda resposta no formato `{success, message, data | errors}`.
- **StandardModelViewSet** — CRUD completo (list/retrieve/create/update/partial_update/destroy) usando o envelope padrão.
- **StandardRetrieveUpdateViewSet** — apenas retrieve + update + partial_update (sem list/create/destroy).

---

## `apps/authentication` — Autenticação e sessão

Cadastro, login e logout com JWT. Não define modelos próprios (usa `users.User` e `users.RefreshToken`).

| Controller | Rota | Método | Função |
|---|---|---|---|
| RegisterView | `/api/auth/register/` | POST | Cria conta e devolve par de tokens JWT |
| LoginView | `/api/auth/login/` | POST | Valida credenciais e emite access/refresh |
| LogoutView | `/api/auth/logout/` | POST | Revoga refresh token da sessão atual |

Cobre **US-01** (Cadastro) e **US-02** (Login).

---

## `apps/users` — Perfil do usuário

Gerencia o usuário autenticado e seus dados de perfil.

### Modelos
- **User** — AbstractUser customizado (login por email). Campos: `display_name`, `avatar_url`, `home_airport`, `preferred_currency`, `is_profile_complete`.
- **RefreshToken** — armazenamento de refresh tokens JWT com expiração e revogação.

### Controllers
| Controller | Rota | Método | Função |
|---|---|---|---|
| UserViewSet | `/api/users/{id}/` | GET / PATCH | Retrieve/update de usuário por ID |
| CurrentUserView | `/api/users/me/` | GET / PATCH | Lê e atualiza o usuário autenticado |

Cobre **US-03** (Gestão de Perfil).

---

## `apps/destinations` — Destinos e POIs

Catálogo de destinos turísticos e seus pontos de interesse.

### Modelos
- **Destination** — `name`, `country`, `city`, `summary`, `hero_image`, `timezone`, `best_season`, `average_rating`, `metadata`.
- **DestinationCostProfile** — orçamento `low/mid/high` por destino em moeda específica.
- **POITag** — tag categórica (nome + slug únicos).
- **PointOfInterest** — `name`, `type` (attraction/restaurant/activity/lodging), `address`, `opening_hours`, `price_level` (1–5), `rating`, `estimated_visit_minutes`, tags M2M, FK destino.

### Controllers
| Controller | Rota | Métodos | Função |
|---|---|---|---|
| DestinationViewSet | `/api/destinations/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD de destinos; filtro por country/city; busca textual |
| DestinationViewSet.search | `/api/destinations/search/` | GET | Busca pública por destino (`?q=`, `?country=`, `?city=`) para a home (AllowAny). Em cache miss (`q` informado e zero resultados locais), aciona `DestinationDiscoveryService.discover` que **roda Firecrawl e Gemini em paralelo** via `ThreadPoolExecutor`, funde os resultados (Firecrawl factual vence em conflito; Gemini complementa lacunas) e persiste. Garante que o destino enriquecido sempre apareça no response mesmo se `_local_search` falhar por mismatch de acento. Audit event renomeado para `destination.discovered` com campo `sources` no metadata. |
| PointOfInterestViewSet | `/api/pois/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD de POIs; filtros por destino/tipo/tag; busca textual |

### `DestinationDiscoveryService` (`apps/destinations/services.py`)

Orquestra a descoberta de um destino combinando Firecrawl + Gemini. Em paralelo (`ThreadPoolExecutor`, `max_workers=2`):
- Firecrawl: `_search_urls` + `_aggregate_payloads` (com fallback Wikipedia interno).
- Gemini: `GeminiDestinationEnricher.enrich` (só se `GEMINI_API_KEY` setada).

Funde: Firecrawl > Gemini em todos os campos escalares (`summary`, `best_season`, `timezone`, `name`, `country`, `city`); `hero_image_url` e `costs` apenas Firecrawl; POIs unidos com dedup por slug (Firecrawl ganha em conflito); POIs novos do Gemini ficam com `metadata['source']='gemini'`. Persiste em transação. Marca cache negativo (`firecrawl:discover_failed:<slug>`) quando os dois falham.

`Destination.metadata` ganha:
- `sources`: `{firecrawl: bool, gemini: bool}` — quem contribuiu.
- `gemini_model`: modelo usado (quando Gemini contribuiu).
- `source_urls`, `extracted` (do Firecrawl, inalterados).
- `scrape_failures` (do Firecrawl, inalterado).

### Management commands

- `python manage.py seed_destinations` — popula a tabela `Destination` via Firecrawl com uma lista curada de cidades brasileiras (Rio, SP, Salvador, Floripa, Bonito, Paraty, etc — 20 cidades default). Útil pra ter dados prontos pro frontend sem depender da busca síncrona. Flags: `--cities` (lista custom), `--country` (default Brasil), `--force` (re-ingere mesmo já populados), `--clear-failure-cache` (limpa cache negativo antes), `--delay N` (segundos entre cidades, default 1.0).

Permissão: `IsAuthenticatedOrReadOnly`. Cobre **US-05** (Destinos) e **US-07** (POIs).

---

## `apps/profiles` — Onboarding do viajante

Preferências comportamentais e de viagem do usuário (1:1).

### Modelos
- **TravelerDNAProfile** — DNA do viajante: `travel_style`, `pace`, `comfort_level`, `social_energy`, `adventure_level`, `food_focus`, `cultural_interest`, `nature_interest`, `nightlife_interest` (escalas 1–10), `notes`.
- **UserTripPreference** — preferências de viagem: `budget_min/max`, `preferred_trip_length` (1–60 dias), `travel_month`, `hotel_level`, `transportation_style`, `dietary_preferences`, `accessibility_needs`, `interests` (JSON).

### Controllers
| Controller | Rota | Métodos | Função |
|---|---|---|---|
| TravelerDNAProfileViewSet | `/api/traveler-dna/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD do DNA do viajante (queryset filtrado pelo usuário logado) |
| UserTripPreferenceViewSet | `/api/trip-preferences/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD de preferências de viagem (filtrado pelo usuário) |

Cobre **US-04** (Traveler DNA) e **US-06** (Trip Preferences).

---

## `apps/itineraries` — Roteiros, favoritos, avaliações e compartilhamento

Núcleo funcional do produto.

### Modelos
- **Itinerary** — destino, `title`, `summary`, datas, `duration_days`, `budget_total`, moeda, `generation_status` (draft/generating/ready/failed), `generation_context`, `metadata`.
- **ItineraryDay** — `day_number`, `title`, `summary`, `estimated_cost`.
- **ItineraryDailyEvent** — atividade do dia: horários, FK opcional para POI, `title`, `description`, `estimated_cost`, `order_index`.
- **FavoriteItinerary** — relação `user` × `itinerary` (unique).
- **Review** — nota 1–5 + título/corpo (unique por usuário+itinerário).
- **ReviewStat** — agregado de `review_count` e `average_rating` por itinerário.
- **SharedItineraryLink** — token UUID, `created_by`, `expires_at`, `is_active`.

### Controllers
| Controller | Rota | Métodos | Função |
|---|---|---|---|
| ItineraryViewSet | `/api/itineraries/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD do roteiro; filtros destino/status; busca por título |
| ItineraryViewSet.generate | `/api/itineraries/{id}/generate/` | POST | Aciona geração via IA; muda status para `generating` e retorna 202 |
| ItineraryViewSet.days | `/api/itineraries/{id}/days/` | GET | Lista todos os dias do roteiro com seus eventos (programação completa) |
| ItineraryViewSet.day_detail | `/api/itineraries/{id}/days/{day_number}/` | GET | Programação de um dia específico (eventos com horário, POI, custo) |
| ItineraryViewSet.templates | `/api/itineraries/templates/` | GET | Lista templates "genéricos" para usuários sem preferências (itinerários com `metadata.is_template=true`, AllowAny) |
| ItineraryViewSet.top_rated | `/api/itineraries/top-rated/` | GET | Ranking público (página principal) ordenado por `ReviewStat.average_rating` desc (AllowAny) |
| FavoriteItineraryViewSet | `/api/favorites/` `[+ /{id}/]` | GET/POST/DELETE | Favoritar / listar / remover favorito |
| ReviewViewSet | `/api/reviews/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD de avaliações; atualiza `ReviewStat` na criação |
| SharedItineraryLinkViewSet | `/api/shared-links/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | Geração/gestão de links públicos do roteiro |

Cobre **US-08** (Criar Itinerário), **US-09** (Geração com IA — gatilho), **US-10** (Visualizar — retrieve), **US-11** (Editar), **US-12** (Favoritos), **US-13** (Avaliações), **US-14** (Compartilhar).

---

## `apps/ai` — Camada LLM

Provê o gerador de roteiro e o enricher de destinos via Gemini (Google).

### Estrutura
- `providers/base.py` — `LLMProvider` Protocol (runtime_checkable) + exceções (`LLMProviderError`, `LLMTimeoutError`, `LLMAuthError`, `LLMQuotaError`, `LLMResponseError`).
- `providers/gemini.py` — `GeminiProvider` (cliente do Gemini via `google-generativeai` SDK). Sem regras de negócio, só envia prompt e parseia retorno (JSON ou texto). Mapeia exceções HTTP do `google.api_core.exceptions` para os tipos tipados.
- `enrichers/base.py` — `BaseDestinationEnricher` + `EnrichmentResult` dataclass (9 campos + `has_meaningful_data()`).
- `enrichers/destination_gemini.py` — `GeminiDestinationEnricher` com retry no `LLMResponseError` (1 tentativa extra). Marca POIs gerados com `source="gemini"`. Sem image_url no schema (nível Moderado).
- `generators/itinerary.py` — `GeminiItineraryGenerator(BaseItineraryGenerator)` consumido por `ItineraryGenerationService.run_job`. Valida `poi_id` retornado contra o DB do mesmo destino; eventos com FK inválida viram freestyle (poi=None).
- `services.py` — `get_generator()` lê `DEFAULT_LLM_PROVIDER`: `"gemini"` (com `GEMINI_API_KEY`) → `GeminiItineraryGenerator`; caso contrário → `MockItineraryGenerator`. Import do Gemini é lazy pra evitar ciclo.

### Modelos (existentes)
- `LLMProvider`, `LLMModel`, `PromptTemplate`, `LLMJob`, `LLMJobLog` — usados pra audit/observabilidade. `LLMJob` armazena `request_payload`/`response_payload` do Gemini pra debug.

### Controllers
| Controller | Rota | Métodos | Função |
|---|---|---|---|
| LLMModelViewSet | `/api/llm-models/` `[+ /{id}/]` | GET | Lista/consulta modelos ativos (read-only) |
| PromptTemplateViewSet | `/api/prompt-templates/` `[+ /{id}/]` | GET | Lista/consulta templates (admin, read-only) |
| LLMJobViewSet | `/api/llm-jobs/` `[+ /{id}/]` | GET | Lista/consulta jobs do usuário com logs (read-only) |

### Tuning (env)
| Variável | Default | Uso |
|---|---|---|
| `DEFAULT_LLM_PROVIDER` | `mock` | Setar `gemini` ativa o gerador real. |
| `GEMINI_API_KEY` | `""` | Chave do Gemini. Se vazia, cai pro Mock. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo do Gemini. |
| `GEMINI_TIMEOUT` | `20` | Timeout (s) do enrichment de destino. |
| `GEMINI_ITINERARY_TIMEOUT` | `40` | Timeout (s) da geração de roteiro (mais alto pois roteiro tende a ser maior). |

### Cobre **US-12** (Geração de Itinerário com IA) + fallback complementar pra **US-05** (Destinos via cache-aside da home).

---

## `apps/audit` — Auditoria

Registro de eventos críticos para compliance e monitoramento.

### Modelos
- **AuditLog** — `event_type`, `actor` (user nullable), `content_type`, `object_id`, `metadata`, `created_at`.

### Controllers
| Controller | Rota | Métodos | Função |
|---|---|---|---|
| AuditLogViewSet | `/api/audit-logs/` `[+ /{id}/]` | GET | Lista/consulta logs (admin, read-only); filtros por event_type/content_type |

Cobre **US-15** (Administração — Audit Logs).

---

## `apps/integrations` — Ingestão externa

Integração com Firecrawl para enriquecer base de destinos/POIs.

### Modelos
Sem modelos próprios — grava em `Destination`, `DestinationCostProfile` e `PointOfInterest`.

### Controllers
| Controller | Rota | Método | Função |
|---|---|---|---|
| FirecrawlIngestView | `/api/firecrawl/ingest/` | POST | Recebe `{destination_id, source_urls[]}`, executa scraping, atualiza destino/POIs e retorna `{destination_updated, poi_count, cost_profile_updated}` (admin) |

> O serviço `FirecrawlIngestionService` também expõe `discover_destination(query, country, city, actor)`, usado pela busca pública de destinos como cache-aside: faz search + scrape em memória primeiro e **só cria/atualiza o `Destination` no banco se o scrape retornar dados úteis** (`summary` ou ao menos um POI). Isso evita placeholders órfãos quando o scrape falha ou estoura timeout.

### Fluxo com a API real do Firecrawl

Quando `FIRECRAWL_API_KEY` está definido, o serviço usa dois endpoints do `https://api.firecrawl.dev/v1`:

1. `POST /search` — recebe `{query, limit}` (limit vem de `FIRECRAWL_SEARCH_LIMIT`, default 2) e retorna URLs candidatas (`data[].url`). A query é montada como `"{query} turismo {country|Brasil}"`. URLs de domínios não suportados pelo Firecrawl (Instagram, Facebook, YouTube, TikTok, X/Twitter, LinkedIn, Reddit, Pinterest, Threads) são descartadas antes do scrape. Se nenhuma URL útil sobrar, faz fallback para `https://pt.wikipedia.org/wiki/<slug>`. Se as URLs do search vierem mas TODAS falharem no scrape, faz uma segunda tentativa com a URL da Wikipedia antes de desistir.
2. `POST /scrape` — recebe `{url, formats: ["json"], jsonOptions: {schema, prompt}}` e retorna `data.json` estruturado conforme o `DESTINATION_EXTRACTION_SCHEMA` da `services.py` (`name`, `country`, `city`, `summary`, `hero_image_url`, `best_season`, `timezone`, `costs.{low,mid,high}`, `pois[]` com `image_url` opcional por POI).

`hero_image_url` é promovido para `Destination.hero_image_url`; `image_url` de cada POI é persistido em `PointOfInterest.metadata['image_url']`. Tipos de POI vindos do LLM passam por `_normalize_poi_type` (aliases como `hotel`→`lodging`, `tour`→`activity`, `cafe`→`restaurant`) antes do fallback final para `activity`.

Erros são mapeados em `FirecrawlError` com status code + trecho do body para diagnóstico: 401 (credencial inválida), 429 (rate limit), demais 4xx (requisição rejeitada), 5xx (indisponibilidade) e payloads não-JSON. A view `search` captura a exceção, registra em log via `logger.exception` e responde com lista vazia (não propaga 500).

#### Arquitetura interna

- `_search_urls(query)` → lista de URLs.
- `_aggregate_payloads(urls)` → `AggregatedExtraction` (sem tocar no DB):
  - tolera falhas por URL (registra em `failures`, segue pra próxima);
  - **early-exit** assim que tiver `summary` + ≥ 1 POI (poupa scrape e latência);
  - levanta `FirecrawlError` somente se TODAS as URLs falharem.
- `_persist_extraction(destination, source_urls, aggregated)` → `IngestionResult`, dentro de `@transaction.atomic`. Falhas no scrape ficam registradas em `Destination.metadata['scrape_failures']`.
- `discover_destination` orquestra: search → aggregate → (se `has_meaningful_data()`) `get_or_create` + persist + promote.
- `ingest_destination(destination, source_urls)` (consumido pela view admin `/api/firecrawl/ingest/`) faz aggregate + persist sobre um `Destination` já existente, em transação.

#### Tuning de timeouts (env)

| Variável | Default | Uso |
|---|---|---|
| `FIRECRAWL_SEARCH_LIMIT` | `2` | URLs solicitadas ao `/search`. Quanto menor, mais rápida a request da busca pública. |
| `FIRECRAWL_CONNECT_TIMEOUT` | `5` | Timeout de conexão TCP (segundos). |
| `FIRECRAWL_SEARCH_TIMEOUT` | `15` | Timeout de leitura do `/search`. |
| `FIRECRAWL_SCRAPE_TIMEOUT` | `25` | Timeout de leitura por chamada `/scrape`. |
| `FIRECRAWL_DISCOVERY_FAILURE_TTL` | `60` | Quando `discover_destination` retorna `None`, o slug fica em cache negativo (`firecrawl:discover_failed:<slug>`) por esse TTL em segundos. Buscas repetidas da mesma query no curto prazo retornam vazio imediato sem chamar Firecrawl. Defina `0` pra desabilitar. |

Quando `FIRECRAWL_API_KEY` está vazio, ambos os métodos caem em um payload mockado (útil em dev/CI sem gastar crédito). Os testes em `tests/test_services.py` exercitam os dois caminhos sem chamadas HTTP reais.

Cobre **US-16** (Ingestão de Dados).

---

## Matriz de cobertura User Story → Controller

| US | Funcionalidade | Endpoint principal | Status |
|---|---|---|---|
| US-01 | Cadastro | `POST /api/auth/register/` | ✅ |
| US-02 | Login/Logout | `POST /api/auth/login/`, `/logout/` | ✅ |
| US-03 | Perfil | `GET/PATCH /api/users/me/` | ✅ |
| US-04 | Traveler DNA | `/api/traveler-dna/` | ✅ |
| US-05 | Destinos | `/api/destinations/` | ✅ |
| US-06 | Trip Preferences | `/api/trip-preferences/` | ✅ |
| US-07 | POIs | `/api/pois/` | ✅ |
| US-08 | Criar Itinerário | `/api/itineraries/` | ✅ |
| US-09 | Gerar com IA | `POST /api/itineraries/{id}/generate/` | ⚠️ gatilho existente; execução assíncrona depende do worker de `apps/ai` |
| US-10 | Visualizar Roteiro | `GET /api/itineraries/{id}/` | ✅ |
| US-11 | Editar Roteiro | `PATCH /api/itineraries/{id}/` | ✅ |
| US-12 | Favoritos | `/api/favorites/` | ✅ |
| US-13 | Avaliações | `/api/reviews/` | ✅ |
| US-14 | Compartilhar | `/api/shared-links/` | ✅ |
| US-15 | Audit Logs | `/api/audit-logs/` | ✅ |
| US-16 | Firecrawl | `POST /api/firecrawl/ingest/` | ✅ |
| RF — Templates genéricos | Roteiros para usuário sem preferências | `GET /api/itineraries/templates/` | ✅ |
| RF — Pesquisa por destino | Busca pública na home | `GET /api/destinations/search/` | ✅ |
| RF — Top avaliados | Ranking público na home | `GET /api/itineraries/top-rated/` | ✅ |

---

## Matriz de permissões

| App | Permissão padrão |
|---|---|
| authentication | `AllowAny` |
| users | `IsAuthenticated` (escopo do próprio usuário no `/me`) |
| destinations | `IsAuthenticatedOrReadOnly` |
| profiles | `IsAuthenticated` (queryset filtrado pelo usuário) |
| itineraries | `IsAuthenticated` (reviews leitura pública) |
| ai | `IsAuthenticated` para jobs/modelos; `IsAdminUser` para templates |
| audit | `IsAdminUser` |
| integrations | `IsAdminUser` |
