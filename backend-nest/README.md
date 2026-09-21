# Viajero Backend NestJS

Backend NestJS criado como migração funcional do backend Django/DRF existente. O projeto Django original permanece intacto em `../backend`.

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL
- Banco existente do projeto Viajero ou banco novo compatível

## Instalação

```bash
cd backend-nest
npm install
```

## Variáveis de ambiente

Crie `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Principais variáveis:

```env
DATABASE_URL=postgresql://postgres:1414@localhost:5432/viajero
JWT_SECRET_KEY=unsafe-dev-secret
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=7
PORT=8001
CORS_ALLOW_ALL_ORIGINS=true
DEFAULT_LLM_PROVIDER=mock
```

## PostgreSQL e TypeORM

As entities usam os nomes de tabelas do Django, como:

- `users_user`
- `destinations_destination`
- `profiles_travelerdnaprofile`
- `itineraries_itinerary`
- `ai_llmjob`
- `audit_auditlog`

`synchronize` está desativado em `src/database/typeorm.config.ts` para evitar alteração automática no schema existente.

## Rodar em desenvolvimento

```bash
npm run start:dev
```

Por padrão a API sobe em:

```text
http://localhost:8001
```

Para apontar o frontend para este backend:

```env
VITE_API_URL=http://localhost:8001
```

## Build

```bash
npm run build
```

## Testes

```bash
npm test
```

Testes incluídos:

- `DjangoPasswordAdapter`: valida encode/verify compatível com `pbkdf2_sha256` do Django.
- `ItineraryComposite`: valida composição de roteiro, dias e eventos.

## Lint

```bash
npm run lint
```

## Principais endpoints compatíveis

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/users/me
PATCH /api/users/me
GET  /api/destinations
GET  /api/destinations/search?q=Lisboa
GET  /api/destinations/:id
GET  /api/pois
GET  /api/traveler-dna
GET  /api/traveler-dna/me
PATCH /api/traveler-dna
PATCH /api/traveler-dna/me
GET  /api/trip-preferences
GET  /api/trip-preferences/me
PATCH /api/trip-preferences
PATCH /api/trip-preferences/me
GET  /api/itineraries
POST /api/itineraries
POST /api/itineraries/:id/generate
GET  /api/itineraries/templates
GET  /api/itineraries/top-rated
GET  /api/favorites
POST /api/favorites
GET  /api/reviews
POST /api/reviews
GET  /api/shared-links
POST /api/shared-links
GET  /api/llm-models
GET  /api/llm-jobs
GET  /api/audit-logs
```

O Nest aceita rotas com ou sem barra final na configuração padrão do Express, preservando chamadas do frontend como `/api/auth/login/`.

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

- Integrações Firecrawl, Gemini e Groq foram mantidas como pontos arquiteturais, mas o backend Nest implementa geração mock compatível para roteiros.
- A descoberta de destinos no Nest possui fallback básico local; o enriquecimento completo ainda está no backend Django.
- A validação final de build/test depende de Node/npm disponível no ambiente.
