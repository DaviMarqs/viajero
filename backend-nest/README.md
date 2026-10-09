# Viajero Backend NestJS

Backend NestJS criado como migração funcional do backend Django/DRF existente. O projeto Django original permanece intacto em `../backend`.

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL
- Banco existente do projeto Viajero ou banco novo compatível

## Primeira execução

Guia completo do projeto (banco, migrations, API, front e problemas comuns): [`../RODAR_LOCALMENTE.md`](../RODAR_LOCALMENTE.md).

O Nest usa o **mesmo banco** do Django: o schema vem das migrations do Django (`../backend`) e o Nest não altera a estrutura (`synchronize: false`).

1. Schema e seed pelo Django (requer `uv`):

```bash
cd backend
uv sync
DATABASE_URL=postgresql://postgres:1414@localhost:5432/viajero uv run manage.py migrate
DATABASE_URL=postgresql://postgres:1414@localhost:5432/viajero uv run manage.py loaddata seed_data.json
```

2. Backend Nest:

```bash
cd backend-nest
npm install
cp .env.example .env
npm run start:dev
```

A API sobe em `http://localhost:8001`. O front (`../front`) já aponta para essa URL por padrão (`VITE_API_URL`).

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://postgres:1414@localhost:5432/viajero
JWT_SECRET_KEY=unsafe-dev-secret
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=7
PORT=8001
CORS_ALLOW_ALL_ORIGINS=true
DEFAULT_LLM_PROVIDER=mock
```

## Convivência com o schema do Django

- **Defaults:** o Django aplica defaults em Python, então as colunas não têm `DEFAULT` no banco. O `DjangoDefaultsSubscriber` (`src/database/django-defaults.subscriber.ts`) preenche, antes de cada INSERT feito por `repository.save()`, os defaults declarados nas entities (`created_at`, `updated_at`, `''`, `'{}'`, `false`...). Inserts via `QueryBuilder.insert()` não passam pelo subscriber; use `save()`.
- **IDs:** `bigint` sai como string (padrão do TypeORM; o bugfix #720 já devolve ids gerados como string e misturar com `number` quebra a comparação de relações ao salvar). Os DTOs aceitam ids numéricos enviados como string (`@ToId()` em `src/common/validation.ts`). Decimais também saem como string (`"4.70"`).
- **FKs:** as constraints do Django são `NO ACTION` (o cascade do Django roda em Python). Apague os filhos antes do pai, como em `AiService.runJob`.

## Uploads

`POST /api/users/me/avatar` (multipart, campo `avatar`: PNG, JPG, WEBP ou GIF até 2 MB) grava em `uploads/avatars/` (fora do git). O Nest serve a pasta em `/uploads/...` com `X-Content-Type-Options: nosniff` e salva a URL absoluta em `avatar_url`.

## Testes

```bash
npm test        # Jest (unitários)
npm run lint
npm run smoke   # smoke HTTP do contrato usado pelo front
```

O `smoke` precisa do backend rodando (`BASE_URL`, padrão `http://localhost:8001`) contra um banco **descartável** migrado pelo Django com o seed: cada execução cria usuários, roteiros e avaliações.

## Principais endpoints

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
PATCH  /api/users/me
POST   /api/users/me/avatar
GET    /api/destinations
GET    /api/destinations/search?q=Lisboa
POST   /api/destinations/suggest
GET    /api/destinations/:id
GET    /api/pois
GET    /api/traveler-dna/me
PATCH  /api/traveler-dna/me
GET    /api/trip-preferences/me
PATCH  /api/trip-preferences/me
GET    /api/itineraries
POST   /api/itineraries
GET    /api/itineraries/:id
PATCH  /api/itineraries/:id
POST   /api/itineraries/:id/generate
GET    /api/itineraries/templates
GET    /api/itineraries/top-rated
GET    /api/reviews?itinerary=:id
POST   /api/reviews
PATCH  /api/reviews/:id
DELETE /api/reviews/:id
GET    /api/favorites
POST   /api/favorites
GET    /api/shared-links
POST   /api/shared-links
GET    /api/llm-models
GET    /api/llm-jobs
GET    /api/audit-logs
```

O Nest aceita rotas com ou sem barra final (padrão do Express), preservando chamadas do front como `/api/auth/login/`. A coleção `../insomnia-viajero.json` usa `base_url = http://127.0.0.1:8000` (Django); troque para `http://localhost:8001` para usar o Nest.

## Roteiros e avaliações

- `POST /api/itineraries` aceita só `{ destination, title }`: duração, orçamento e moeda vêm das preferências do usuário (duração padrão 5 dias), como no Django.
- Um roteiro é **público** quando está pronto e tem ao menos uma avaliação (ou `metadata.is_template = true`). O dono avalia o próprio roteiro pronto; qualquer usuário logado pode abrir e avaliar roteiros públicos (`GET /api/itineraries/:id` devolve `is_owner`). Uma avaliação por usuário, editável e excluível; toda mudança recalcula `ReviewStat`.
- `GET /api/reviews` é público e expõe só `{ id, display_name, avatar_url }` do autor.
- `top-rated` lista só roteiros prontos e avaliados, pela média.

## Contrato de resposta

Respostas de sucesso seguem o padrão do `StandardResponseMixin` do DRF:

```json
{
  "success": true,
  "message": "Registro carregado com sucesso.",
  "data": {}
}
```

Erros são tratados por `ApiExceptionFilter`:

```json
{
  "success": false,
  "message": "Nao foi possivel processar a solicitacao.",
  "errors": {}
}
```

Mensagens padrão do framework (401, rota inexistente, validação, upload) saem em português. Erros 5xx são registrados no log do servidor e respondem com `errors: {}`, sem detalhes internos.

## Design Patterns

A documentação acadêmica está em:

```text
DESIGN_PATTERNS.md
```

Padrões implementados:

- Facade: `ItineraryGenerationFacade`
- Adapter: `DjangoPasswordAdapter`
- Composite: `ItineraryComposite`, `ItineraryDayComposite`, `ItineraryEventLeaf`
- Decorator: `AuditedServiceDecorator`
- Singleton: `AuditService` via DI do NestJS
- Factory: `ItineraryGeneratorFactory`
- Builder: `ApiResponseBuilder`

## Migrations

Este projeto não cria migrations automaticamente porque foi desenhado para ler o schema existente do Django. Para evolução futura, crie migrations TypeORM de forma controlada e revise manualmente antes de aplicar em produção.

## Limitações conhecidas da migração

- Sem LLM real: a geração de roteiro (mock) e a sugestão de destino (heurística pelo DNA/interesses) são determinísticas.
- A descoberta de destino sem resultado local cria um destino básico (país "Desconhecido", sem POIs); o enriquecimento completo continua no Django.
- Sem refresh token: o access token expira em `JWT_ACCESS_MINUTES` e o front volta para o login.
