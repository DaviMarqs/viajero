# Viajero Backend NestJS

Backend principal do Viajero, usado pelo front. Nasceu como migração funcional do backend Django/DRF (`../backend`) e hoje cobre todos os recursos dele, inclusive a IA: geração de roteiro com LLM (Groq/Gemini), descoberta de destinos com Firecrawl + LLM e sugestão de destino pelo perfil. O Nest também é o dono do schema: migrations TypeORM, seed e importação dos dados antigos do Django. O `../backend` (Django) é legado e não é necessário para rodar.

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL
- Banco vazio (o Nest cria as tabelas) ou um banco já criado pelo Django (usado como está)

## Primeira execução

Guia completo do projeto (banco, migrations, API, front e problemas comuns): [`../RODAR_LOCALMENTE.md`](../RODAR_LOCALMENTE.md).

As tabelas vêm das migrations do próprio Nest (`src/database/migrations`, veja [Banco](#banco-migrations-seed-e-dados-antigos)). O schema é o mesmo que o Django criava, então um banco antigo do Django continua servindo. O TypeORM não altera a estrutura sozinho (`synchronize: false`).

```bash
cd backend-nest
npm ci
cp .env.example .env
npm run start:dev
```

O `start:dev` (`scripts/dev.mjs`) deixa o banco pronto antes de subir o Nest em watch: se o PostgreSQL do `DATABASE_URL` não responde, sobe o serviço `db` do `../docker-compose.yml` (container `viajero-pg`); aplica as migrations do Nest e carrega o seed se o banco não tiver destinos (o mesmo que `npm run db:setup`). Não usa Django nem `uv`. `npm run start:watch` sobe só o Nest. Para rodar banco, API e front no Docker: `docker compose up --build` na raiz.

A API sobe em `http://localhost:8001`. O front (`../front`) já aponta para essa URL por padrão (`VITE_API_URL`).

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://postgres:1414@localhost:5432/viajero
JWT_SECRET_KEY=unsafe-dev-secret
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=7
PORT=8001
CORS_ALLOW_ALL_ORIGINS=true
```

IA (todas opcionais; o `.env.example` traz os padrões):

| Variável | Padrão | Uso |
|---|---|---|
| `DEFAULT_LLM_PROVIDER` | `groq` | Provedor da geração de roteiro: `groq`, `gemini` ou `mock`. O outro provedor com chave entra como reserva |
| `GROQ_API_KEY` | vazio | Chave do Groq. Sem ela (e sem Gemini) o roteiro sai do gerador mock |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modelo do Groq. O antigo `llama-3.3-70b-versatile` foi removido pelo Groq |
| `GROQ_REASONING_EFFORT` | `low` para gpt-oss | `off` não envia o parâmetro (modelos que não aceitam) |
| `GROQ_TIMEOUT` / `GROQ_ITINERARY_TIMEOUT` | 20 / 40 s | Timeout das chamadas curtas e da geração de roteiro |
| `GROQ_MAX_TOKENS` | 8192 | Limite de resposta padrão (o roteiro calcula o seu pela duração) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT`, `GEMINI_ITINERARY_TIMEOUT`, `GEMINI_MAX_TOKENS` | vazio, `gemini-2.5-flash-lite`, 20, 40, 8192 | Mesmo papel para o Gemini |
| `FIRECRAWL_API_KEY` | vazio | Liga o Firecrawl na descoberta de destinos |
| `FIRECRAWL_SEARCH_LIMIT` | 2 | URLs buscadas por destino |
| `FIRECRAWL_SEARCH_TIMEOUT` / `FIRECRAWL_SCRAPE_TIMEOUT` | 15 / 25 s | Timeouts do Firecrawl (o scrape com extração leva ~13 s) |
| `FIRECRAWL_DISCOVERY_BUDGET` | 45 s | Tempo máximo gasto no Firecrawl por descoberta |
| `FIRECRAWL_DISCOVERY_FAILURE_TTL` | 60 s | Cache negativo: não repete descoberta que acabou de falhar |

## IA

Tudo em `src/modules/ai/llm` (provedores) e `src/modules/destinations/discovery` (destinos). Os provedores falam com as APIs REST via `fetch`, sem SDK.

- **Geração de roteiro** (`POST /api/itineraries/:id/generate`): monta o prompt com o DNA do usuário, os parâmetros da viagem (`trip_preferences` do roteiro) e os 30 POIs mais bem avaliados do destino; pede texto em português, horários `HH:MM` e custos numéricos. A resposta é normalizada (POI de outro destino perde o vínculo, eventos ordenados por horário, tamanhos das colunas) e os custos são reescalados para a faixa de orçamento, como no Django. Resposta inválida ou com dias faltando ganha uma nova tentativa com o motivo no prompt; timeout, cota ou credencial passam para o próximo provedor. Falha final: 503 (limite/timeout da IA) ou 500; o roteiro fica `failed` só se ainda não tinha programação.
- **Regenerar** (mesmo `POST .../generate`, botão "Gerar novamente" no front): troca os dias numa transação, mantém as datas e o nome renomeado pelo usuário (`metadata.title_customized`, marcado no PATCH do título). Se a IA falhar, a programação anterior continua e o status volta a `ready`. Na regeneração, a faixa de orçamento da viagem manda (o custo da geração anterior não entra no prompt).
- **Busca de destino** (`GET /api/destinations/search?q=`): banco local primeiro (aceita nomes em português). Sem resultado, o resolver de IA normaliza o termo e recusa o que não é lugar (400 com `errors.q`); depois tenta o nome canônico no banco e, por fim, descobre o destino: Firecrawl (busca + scrape com extração) e LLM em paralelo, merge (Firecrawl tem prioridade), POIs/tags/custos gravados e foto da Wikipedia (desambiguada pela região, ex.: "Formiga (Minas Gerais)"). Imagens do Firecrawl só entram se a URL responder como imagem. Circuit breaker e cache negativo ficam em memória.
- **Sugestão** (`POST /api/destinations/suggest`): o LLM escolhe um destino pelo perfil, priorizando o Brasil e evitando destinos que o usuário já tem roteiro; o destino é buscado ou descoberto. Sem chave, ou se a IA falhar, usa a heurística local por DNA/interesses.
- **Ingestão manual** (`POST /api/firecrawl/ingest`, admin): `{ destination_id, source_urls }`.

Sem nenhuma chave, tudo continua funcionando offline: roteiro mock, busca cria destino básico e sugestão heurística.

`npm run backfill:hero-images -- [--force] [--limit N] [--delay S]` preenche `hero_image_url` vazio pela Wikipedia (equivalente ao comando `backfill_hero_images` do Django).

## Schema herdado do Django

A baseline reproduz o schema que o Django criava, então valem as regras dele:

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

O `smoke` precisa do backend rodando (`BASE_URL`, padrão `http://localhost:8001`) contra um banco **descartável** criado pelo Nest com o seed (`npm run db:setup`, que o `start:dev` já roda): cada execução cria usuários, roteiros e avaliações.

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
GET    /api/llm-models/:id
GET    /api/llm-jobs
GET    /api/llm-jobs/:id
GET    /api/prompt-templates          (admin)
GET    /api/prompt-templates/:id      (admin)
POST   /api/firecrawl/ingest          (admin)
GET    /api/audit-logs
```

O Nest aceita rotas com ou sem barra final (padrão do Express), preservando chamadas do front como `/api/auth/login/`. A coleção `../insomnia-viajero.json` usa `base_url = http://localhost:8001` (Nest).

## Roteiros e avaliações

- `POST /api/itineraries` recebe `{ destination, title, trip_preferences, ... }` (payload do front). `trip_preferences` são os parâmetros desta viagem e são obrigatórios para gerar; sem eles, duração, orçamento e moeda vêm das preferências do usuário (duração padrão 5 dias), como no Django.
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

## Banco: migrations, seed e dados antigos

O schema vem das migrations TypeORM em `src/database/migrations`, registradas na tabela `nest_migrations`. A primeira (`Baseline`) cria as tabelas da aplicação exatamente como as migrations do Django criavam (mesmas colunas, constraints, índices e FKs), sem as tabelas internas do Django (`django_*`, `auth_*`, `authtoken_token` e as M2M de grupos e permissões do usuário). Num banco que já veio do Django (tem `users_user`), a baseline só é registrada e não mexe em nada: nenhum dado se perde.

| Comando | O que faz |
|---|---|
| `npm run db:setup` | Migrations pendentes e o seed, se não houver destinos. É o que o `start:dev` e o container da API rodam na subida |
| `npm run migration:run` | Só as migrations pendentes |
| `npm run migration:revert` | Desfaz a última. A baseline só apaga as tabelas num banco criado pelo Nest; num banco vindo do Django não faz nada |
| `npm run migration:show` | Lista as migrations e quais já rodaram |
| `npm run migration:create -- src/database/migrations/NomeDaMudanca` | Cria uma migration vazia para escrever o SQL |
| `npm run seed` | Carrega `seed/seed_data.json` (4 destinos, 4 perfis de custo, 8 tags e 16 POIs) se ainda não houver destinos |
| `npm run fixtures:load -- <arquivo.json>` | Importa um `dumpdata` do Django (veja abaixo) |

Os comandos usam o `DATABASE_URL` do ambiente ou do `.env`. Na imagem Docker (sem ts-node) os equivalentes são `node dist/cli/migrate-and-seed.js`, `node dist/cli/seed.js`, `node dist/cli/load-fixtures.js <arquivo.json>` e `npx typeorm migration:revert -d dist/database/data-source.js`.

Para mudar o schema, crie uma migration com `migration:create` e escreva o SQL à mão. Não use `migration:generate` nem `synchronize`: as entities não repetem os nomes das constraints, os `ON DELETE` e a ausência de `DEFAULT` do schema herdado, então o diff gerado sairia cheio de alterações indevidas. O teste `src/database/__tests__/baseline.spec.ts` confere se toda entity e coluna mapeada existe na baseline.

### Importar dados do Django (`fixtures:load`)

O `fixtures:load` lê o JSON do `manage.py dumpdata`, o mesmo formato do seed, e grava pelo metadata das entities: o modelo `app.model` vira a tabela `app_model`, a FK `user` vira `user_id` e a lista de um M2M (`tags`) vira linhas na tabela de junção. Campos ausentes recebem o default do modelo. Grava por PK (insere ou atualiza) numa transação, com as FKs checadas no fim, e acerta as sequences. Se algo falhar, nada é gravado.

- Modelo sem tabela no Nest (`contenttypes`, `sessions`, `auth`...) aborta com a lista; `--skip-unknown` ignora esses modelos.
- Texto maior que o `varchar` da coluna aborta listando os registros (o SQLite não valida tamanho, o PostgreSQL recusa); `--truncate` corta no limite da coluna.
- Chaves naturais (`--natural-foreign`/`--natural-primary`) não são suportadas.

Passo a passo para trazer o SQLite antigo (`backend/db.sqlite3`). É o único uso que sobrou do Django, e só para exportar:

```bash
# 1. Copie o SQLite e atualize a cópia para o schema atual do Django (sem isso o dumpdata falha por coluna faltando)
cp backend/db.sqlite3 /tmp/viajero-legado.sqlite3
cd backend
uv sync
DATABASE_URL=sqlite:////tmp/viajero-legado.sqlite3 uv run manage.py migrate --noinput

# 2. Exporte só os apps da aplicação
DATABASE_URL=sqlite:////tmp/viajero-legado.sqlite3 uv run manage.py dumpdata \
  users destinations profiles itineraries ai audit --indent 2 --output /tmp/viajero-legado.json

# 3. Banco PostgreSQL vazio, só com as tabelas (sem o seed: os ids do seed colidem com os do dump)
cd ../backend-nest
npm run migration:run

# 4. Importe
npm run fixtures:load -- /tmp/viajero-legado.json --truncate
```

No PowerShell, use `$env:DATABASE_URL="sqlite:///C:/temp/viajero-legado.sqlite3"` antes dos comandos do Django. Se o banco de destino já tem o seed ou outros dados, zere antes (passo 11 do [`RODAR_LOCALMENTE.md`](../RODAR_LOCALMENTE.md)). Depois do import, o `start:dev` e o `docker compose up` não carregam o seed, porque já há destinos.

Com o `db.sqlite3` do repositório, o import trouxe 420 registros: 3 usuários, 11 destinos, 9 perfis de custo, 194 tags, 180 POIs, 473 ligações POI–tag, 1 DNA de viajante, 1 preferência de viagem e 21 logs de auditoria. Três slugs de POI com mais de 50 caracteres foram cortados pelo `--truncate`. O resultado bate com um `loaddata` do Django no mesmo dump; só os ids internos da tabela de junção saem em outra ordem.

## Limitações conhecidas da migração

- A geração de roteiro é síncrona: o `POST .../generate` só responde quando o roteiro fica pronto (5 a 15 s com o Groq).
- O plano gratuito do Groq limita tokens por minuto (8.000) e por dia (200.000) no `gpt-oss-120b`; um roteiro gasta de 4 a 6 mil tokens. Em HTTP 429 a chamada é repetida até 3 vezes, esperando o tempo pedido pelo Groq (até 30 s no total); depois disso responde 503.
- Circuit breaker e cache negativo do Firecrawl ficam em memória (zeram ao reiniciar).
- Sem refresh token: o access token expira em `JWT_ACCESS_MINUTES` e o front volta para o login.
