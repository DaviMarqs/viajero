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
| DestinationViewSet.search | `/api/destinations/search/` | GET | Busca pública por destino (`?q=`, `?country=`, `?city=`) para a home (AllowAny) |
| PointOfInterestViewSet | `/api/pois/` `[+ /{id}/]` | GET/POST/PUT/PATCH/DELETE | CRUD de POIs; filtros por destino/tipo/tag; busca textual |

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

## `apps/ai` — Registro de IA e jobs

Configuração de modelos LLM, templates de prompt e rastreamento de execuções.

### Modelos
- **LLMProvider** — `key`, `name`, `config`, `is_active`.
- **LLMModel** — FK provider, `key`, `name`, `context_window`, `is_default`, `is_active`.
- **PromptTemplate** — `key`, `name`, `template`, `version`, `is_active`, `metadata`.
- **LLMJob** — `user`, `itinerary?`, `destination?`, `prompt_template`, `llm_model`, `job_type`, `status` (queued/running/completed/failed), `request_payload`, `response_payload`, `error_message`.
- **LLMJobLog** — log por job com `level` (info/warn/error), `message`, `payload`.

### Controllers
| Controller | Rota | Métodos | Função |
|---|---|---|---|
| LLMModelViewSet | `/api/llm-models/` `[+ /{id}/]` | GET | Lista/consulta modelos ativos (read-only) |
| PromptTemplateViewSet | `/api/prompt-templates/` `[+ /{id}/]` | GET | Lista/consulta templates (admin, read-only) |
| LLMJobViewSet | `/api/llm-jobs/` `[+ /{id}/]` | GET | Lista/consulta jobs do usuário com logs (read-only) |

Suporta o motor que atende **US-09**.

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
