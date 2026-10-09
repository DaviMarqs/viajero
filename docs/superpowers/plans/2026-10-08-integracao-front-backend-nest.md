# Integração Front ↔ Backend-nest + Avaliações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o front novo (`front/`) funcionar ponta a ponta contra o `backend-nest`, e entregar avaliações de roteiros (backend + tela) conforme o RF08.

**Architecture:** O backend-nest passa a honrar o contrato que o front (e o Django) já usam: subscriber global do TypeORM reproduz os defaults do Django, ids `bigint` viram `number`, endpoints ausentes são criados e mensagens de erro saem em PT. O front muda só onde está errado (mensagens, 401, sincronização do usuário), perde o mock e ganha a seção de avaliações + ranking na Home.

**Tech Stack:** NestJS 10, TypeORM 0.3.31 (PostgreSQL, schema do Django), class-validator, Jest; React 19, Vite 8, TypeScript 6, Tailwind v4, react-hook-form + zod, Radix.

**Spec:** `docs/superpowers/specs/2026-10-08-integracao-front-backend-nest-design.md`

---

## Convenções

- **Commits:** mensagens em PT no estilo conventional commits, **sem** trailer `Co-Authored-By` (regra do repositório). Não fazer push.
- **Mensagens da API:** PT sem acento (convenção do projeto), ex.: `Roteiro nao encontrado.`. **Textos de UI:** PT com acento.
- **Controllers:** sempre `const data = await ...;` **antes** de `this.response.withMessage(...).build(data)`. O `ApiResponseBuilder` é compartilhado pelo controller; chamar `withMessage` antes do `await` deixa outra requisição trocar a mensagem no meio.
- **Front build:** `npm run build` altera `front/tsconfig.tsbuildinfo` (versionado). Restaurar com `git checkout -- front/tsconfig.tsbuildinfo` antes de commitar.
- **Shell:** zsh. Não usar `path` nem `status` como nome de variável.

## Ambiente de teste (usado nas Tasks 13 e 23)

Banco **descartável**, recém-migrado pelo Django, sem nenhum default simulado:

```bash
docker rm -f viajero-nest-it 2>/dev/null
docker run -d --name viajero-nest-it -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=viajero_it -p 55432:5432 postgres:16
until docker exec viajero-nest-it pg_isready -U postgres -d viajero_it >/dev/null 2>&1; do sleep 1; done
cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/viajero_it uv run manage.py migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/viajero_it uv run manage.py loaddata seed_data.json
```

Backend-nest apontando para ele (em background):

```bash
cd backend-nest && npm run build
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/viajero_it JWT_SECRET_KEY=it-secret PORT=8001 CORS_ALLOW_ALL_ORIGINS=true DEFAULT_LLM_PROVIDER=mock node dist/main.js
```

## File Structure

```
backend-nest/
├── .gitignore                                        [NOVO] uploads/
├── package.json                                      [MOD] lint só em src; script smoke
├── README.md                                         [MOD]
├── scripts/smoke-contract.mjs                        [NOVO] smoke HTTP do contrato do front
└── src/
    ├── main.ts                                       [MOD] /uploads estático
    ├── database/
    │   ├── typeorm.config.ts                         [MOD] parseInt8 + subscriber
    │   ├── django-defaults.subscriber.ts             [NOVO] defaults do Django no beforeInsert
    │   └── __tests__/django-defaults.subscriber.spec.ts
    ├── common/
    │   ├── api-exception.filter.ts                   [MOD] mensagens PT, log 5xx
    │   ├── uploads.ts                                [NOVO] pasta/URL de uploads
    │   ├── validation.ts                             [NOVO] isDefined p/ DTOs de PATCH
    │   ├── facades/itinerary-generation.facade.ts    [MOD] falha → failed + erro PT
    │   ├── __tests__/api-exception.filter.spec.ts
    │   └── facades/__tests__/itinerary-generation.facade.spec.ts
    └── modules/
        ├── auth/auth.service.ts                      [MOD] mensagens PT
        ├── users/{users.controller,users.service}.ts [MOD] avatar
        ├── users/avatar-upload.ts (+ __tests__)      [NOVO] opções do upload
        ├── profiles/dto/update-*.dto.ts              [NOVO] PATCH validado
        ├── profiles/{profiles.module,profiles.service,traveler-dna.controller,trip-preferences.controller}.ts [MOD]
        ├── destinations/destination-suggestion.ts (+ spec)        [NOVO] scoring puro
        ├── destinations/destination-suggestion.service.ts         [NOVO]
        ├── destinations/{destinations.controller,destinations.module,destinations.service}.ts [MOD]
        ├── itineraries/itinerary-rules.ts (+ spec)   [NOVO] defaults de criação + visibilidade
        ├── itineraries/review.presenter.ts (+ spec)  [NOVO]
        ├── itineraries/reviews.service.ts            [NOVO]
        ├── itineraries/dto/{update-itinerary,update-review}.dto.ts [NOVO]
        ├── itineraries/dto/{create-itinerary,create-review}.dto.ts [MOD]
        ├── itineraries/{itineraries.controller,itineraries.service,itineraries.module,reviews.controller}.ts [MOD]
        └── ai/ai.service.ts                          [MOD] regeneração transacional
front/
├── README.md                                         [MOD]
└── src/
    ├── main.tsx                                      [MOD] sem mock
    ├── mock-backend.ts                               [REMOVIDO]
    ├── lib/{api,auth,itineraries,utils}.ts           [MOD]
    ├── lib/reviews.ts                                [NOVO]
    ├── contexts/authContext.tsx                      [MOD]
    ├── types/travel.ts                               [MOD]
    ├── hooks/useItineraries.ts                       [MOD]
    ├── hooks/useReviews.ts                           [NOVO]
    ├── components/ui/star-rating.tsx                 [NOVO]
    ├── features/reviews/{review-form,review-list,reviews-section}.tsx [NOVO]
    └── pages/{login/login,user-profile/user,roteiros/roteiro-detalhe,roteiros/itinerary-card,dashboard/dashboard}.tsx [MOD]
insomnia-viajero.json                                 [MOD] request de avatar
```

---

## Task 1: Script de lint do backend-nest

**Files:**
- Modify: `backend-nest/package.json` (script `lint`)

- [ ] **Step 1: Confirmar a falha atual**

Run: `cd backend-nest && npm run lint`
Expected: FAIL com `No files matching the pattern "test/**/*.ts" were found.`

- [ ] **Step 2: Corrigir o script**

Em `backend-nest/package.json`, trocar:

```json
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
```

por:

```json
    "lint": "eslint \"src/**/*.ts\"",
```

- [ ] **Step 3: Rodar o lint**

Run: `cd backend-nest && npm run lint`
Expected: PASS (0 errors; 1 warning de `Query` sem uso em `itineraries.controller.ts`, removido na Task 6)

- [ ] **Step 4: Commit**

```bash
git add backend-nest/package.json
git commit -m "chore(backend-nest): lint apenas em src"
```

---

## Task 2: Defaults do Django no TypeORM + ids numéricos

**Files:**
- Create: `backend-nest/src/database/django-defaults.subscriber.ts`
- Create: `backend-nest/src/database/__tests__/django-defaults.subscriber.spec.ts`
- Modify: `backend-nest/src/database/typeorm.config.ts`

- [ ] **Step 1: Escrever o teste (falha por módulo inexistente)**

`backend-nest/src/database/__tests__/django-defaults.subscriber.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { applyDjangoDefaults, resolveColumnDefault } from '../django-defaults.subscriber';
import { User } from '../../modules/users/user.entity';
import { RefreshToken } from '../../modules/users/refresh-token.entity';
import { TravelerDnaProfile, UserTripPreference } from '../../modules/profiles/entities';
import {
  FavoriteItinerary,
  Itinerary,
  ItineraryDailyEvent,
  ItineraryDay,
  Review,
  ReviewStat,
  SharedItineraryLink,
} from '../../modules/itineraries/entities';
import { Destination, DestinationCostProfile, PoiTag, PointOfInterest } from '../../modules/destinations/entities';
import { AuditLog } from '../../modules/audit/audit-log.entity';
import { LlmJob, LlmJobLog, LlmModel, LlmProvider, PromptTemplate } from '../../modules/ai/entities';

const ENTITIES = [
  User, RefreshToken, TravelerDnaProfile, UserTripPreference, Itinerary, ItineraryDay, ItineraryDailyEvent,
  FavoriteItinerary, Review, ReviewStat, SharedItineraryLink, Destination, DestinationCostProfile, PoiTag,
  PointOfInterest, AuditLog, LlmProvider, LlmModel, PromptTemplate, LlmJob, LlmJobLog,
];

describe('resolveColumnDefault', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');

  it('usa o instante informado para colunas de data de criacao/atualizacao', () => {
    expect(resolveColumnDefault({ default: undefined, isCreateDate: true, isUpdateDate: false }, now)).toEqual(now);
    expect(resolveColumnDefault({ default: undefined, isCreateDate: false, isUpdateDate: true }, now)).toEqual(now);
  });

  it('converte defaults SQL declarados como funcao', () => {
    expect(resolveColumnDefault({ default: () => "'{}'", isCreateDate: false, isUpdateDate: false }, now)).toEqual({});
    expect(resolveColumnDefault({ default: () => "'[]'", isCreateDate: false, isUpdateDate: false }, now)).toEqual([]);
    expect(resolveColumnDefault({ default: () => 'CURRENT_TIMESTAMP', isCreateDate: false, isUpdateDate: false }, now)).toEqual(now);
  });

  it('devolve literais como estao e undefined quando nao ha default', () => {
    expect(resolveColumnDefault({ default: '', isCreateDate: false, isUpdateDate: false }, now)).toBe('');
    expect(resolveColumnDefault({ default: 'BRL', isCreateDate: false, isUpdateDate: false }, now)).toBe('BRL');
    expect(resolveColumnDefault({ default: 0, isCreateDate: false, isUpdateDate: false }, now)).toBe(0);
    expect(resolveColumnDefault({ default: false, isCreateDate: false, isUpdateDate: false }, now)).toBe(false);
    expect(resolveColumnDefault({ default: undefined, isCreateDate: false, isUpdateDate: false }, now)).toBeUndefined();
  });
});

describe('applyDjangoDefaults com metadata real das entities', () => {
  const dataSource = new DataSource({ type: 'postgres', entities: ENTITIES });

  beforeAll(async () => {
    // buildMetadatas monta a metadata sem abrir conexao com o banco.
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  it('preenche todos os defaults do usuario sem tocar no que foi informado', () => {
    const user = Object.assign(new User(), { email: 'a@b.dev', username: 'a', password: 'x', preferred_currency: 'EUR' });
    const now = new Date('2026-10-08T12:00:00.000Z');

    applyDjangoDefaults(dataSource.getMetadata(User).columns, user, now);

    expect(user.date_joined).toEqual(now);
    expect(user.created_at).toEqual(now);
    expect(user.updated_at).toEqual(now);
    expect(user.avatar_url).toBe('');
    expect(user.home_airport).toBe('');
    expect(user.display_name).toBe('');
    expect(user.is_profile_complete).toBe(false);
    expect(user.is_active).toBe(true);
    expect(user.preferred_currency).toBe('EUR');
    expect(user.last_login).toBeUndefined();
    expect(user.id).toBeUndefined();
  });

  it('cria objetos json independentes e ignora colunas de relacao', () => {
    const first = new Itinerary();
    const second = new Itinerary();
    const columns = dataSource.getMetadata(Itinerary).columns;

    applyDjangoDefaults(columns, first);
    applyDjangoDefaults(columns, second);

    expect(first.metadata).toEqual({});
    expect(first.generation_context).toEqual({});
    expect(first.metadata).not.toBe(second.metadata);
    expect(first.generation_status).toBe('draft');
    expect(first.user).toBeUndefined();
    expect(first.destination).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/database`
Expected: FAIL com `Cannot find module '../django-defaults.subscriber'`

- [ ] **Step 3: Implementar o subscriber**

`backend-nest/src/database/django-defaults.subscriber.ts`:

```ts
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, ObjectLiteral } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';

const TIMESTAMP_DEFAULTS = new Set(['CURRENT_TIMESTAMP', 'NOW()']);

/**
 * Valor que o Django gravaria numa coluna omitida no INSERT.
 * As migrations do Django nao criam DEFAULT no banco (o Django aplica os
 * defaults em Python), entao o DEFAULT que o TypeORM envia vira NULL.
 */
export function resolveColumnDefault(
  column: Pick<ColumnMetadata, 'default' | 'isCreateDate' | 'isUpdateDate'>,
  now: Date = new Date(),
): unknown {
  if (column.isCreateDate || column.isUpdateDate) return new Date(now);
  const raw: unknown = typeof column.default === 'function' ? (column.default as () => unknown)() : column.default;
  if (typeof raw !== 'string') return raw;
  if (TIMESTAMP_DEFAULTS.has(raw.trim().toUpperCase())) return new Date(now);
  const quoted = /^'(.*)'$/s.exec(raw);
  if (!quoted) return raw;
  try {
    return JSON.parse(quoted[1]) as unknown;
  } catch {
    return quoted[1];
  }
}

export function applyDjangoDefaults(columns: ColumnMetadata[], entity: ObjectLiteral | undefined, now: Date = new Date()): void {
  if (!entity) return;
  for (const column of columns) {
    if (column.isGenerated || column.isVirtual || column.relationMetadata) continue;
    if (column.getEntityValue(entity) !== undefined) continue;
    const value = resolveColumnDefault(column, now);
    if (value !== undefined) column.setEntityValue(entity, value);
  }
}

/** Funciona para todo `repository.save()`; inserts via QueryBuilder.insert() nao passam por aqui. */
@EventSubscriber()
export class DjangoDefaultsSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<ObjectLiteral>): void {
    applyDjangoDefaults(event.metadata.columns, event.entity);
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend-nest && npx jest src/database`
Expected: PASS (5 testes)

- [ ] **Step 5: Registrar subscriber e `parseInt8`**

> **Revisado na execução:** `parseInt8` foi removido depois (conflita com o bugfix #720 do TypeORM e quebrou a regeneração). Ids `bigint` ficam string e os DTOs usam `@ToId()` (`common/validation.ts`). Ver spec 1.2.

`backend-nest/src/database/typeorm.config.ts`:

```ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DjangoDefaultsSubscriber } from './django-defaults.subscriber';

export function databaseConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:1414@localhost:5432/viajero',
    autoLoadEntities: true,
    synchronize: false,
    // bigint (ids do Django) como number, igual ao DRF.
    parseInt8: true,
    subscribers: [DjangoDefaultsSubscriber],
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
```

- [ ] **Step 6: Build**

Run: `cd backend-nest && npm run build`
Expected: sem erros

- [ ] **Step 7: Commit**

```bash
git add backend-nest/src/database
git commit -m "fix(backend-nest): defaults do Django no insert e ids numericos"
```

---

## Task 3: Mensagens de erro em PT e sem vazamento de SQL

**Files:**
- Modify: `backend-nest/src/common/api-exception.filter.ts`
- Create: `backend-nest/src/common/__tests__/api-exception.filter.spec.ts`
- Modify: `backend-nest/src/modules/auth/auth.service.ts`
- Modify: `backend-nest/src/modules/users/users.service.ts`
- Modify: `backend-nest/src/modules/destinations/destinations.service.ts`

- [ ] **Step 1: Escrever o teste**

`backend-nest/src/common/__tests__/api-exception.filter.spec.ts`:

```ts
import { ArgumentsHost, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiExceptionFilter, resolveErrorMessage } from '../api-exception.filter';

function hostFor(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
}

describe('resolveErrorMessage', () => {
  it('troca mensagens padrao do framework por PT', () => {
    expect(resolveErrorMessage(401, { message: 'Unauthorized', statusCode: 401 })).toBe('Sessao expirada ou nao autenticada. Entre novamente.');
    expect(resolveErrorMessage(404, { message: 'Cannot POST /api/x', error: 'Not Found', statusCode: 404 })).toBe('Recurso nao encontrado.');
    expect(resolveErrorMessage(413, { message: 'File too large', error: 'Payload Too Large', statusCode: 413 })).toBe('Arquivo muito grande. O limite e 2 MB.');
    expect(resolveErrorMessage(400, { message: 'Validation failed (numeric string is expected)', statusCode: 400 })).toBe('Dados invalidos. Verifique os campos enviados.');
  });

  it('resume erros do class-validator', () => {
    expect(resolveErrorMessage(400, { message: ['rating must not be greater than 5'], statusCode: 400 })).toBe('Dados invalidos. Verifique os campos enviados.');
  });

  it('mantem mensagens lancadas pelo dominio', () => {
    expect(resolveErrorMessage(404, { message: 'Roteiro nao encontrado.', error: 'Not Found', statusCode: 404 })).toBe('Roteiro nao encontrado.');
    expect(resolveErrorMessage(500, { message: 'Nao foi possivel gerar o roteiro. Tente novamente.', statusCode: 500 })).toBe('Nao foi possivel gerar o roteiro. Tente novamente.');
  });

  it('usa mensagem generica para 5xx sem mensagem de dominio', () => {
    expect(resolveErrorMessage(500, undefined)).toBe('Nao foi possivel processar a solicitacao.');
    expect(resolveErrorMessage(500, { message: 'Internal Server Error', statusCode: 500 })).toBe('Nao foi possivel processar a solicitacao.');
  });
});

describe('ApiExceptionFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  function run(exception: unknown) {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    new ApiExceptionFilter().catch(exception, hostFor(response));
    return { status: response.status.mock.calls[0][0] as number, body: response.json.mock.calls[0][0] as Record<string, unknown> };
  }

  it('nao expoe detalhes de erros inesperados', () => {
    const { status, body } = run(new Error('null value in column "date_joined" violates not-null constraint'));
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, message: 'Nao foi possivel processar a solicitacao.', errors: {} });
  });

  it('mantem o corpo de erros 4xx em errors', () => {
    const { status, body } = run(new NotFoundException('Roteiro nao encontrado.'));
    expect(status).toBe(404);
    expect(body.message).toBe('Roteiro nao encontrado.');
    expect(body.errors).toMatchObject({ message: 'Roteiro nao encontrado.' });
  });

  it('traduz 401 do passport', () => {
    expect(run(new UnauthorizedException()).body.message).toBe('Sessao expirada ou nao autenticada. Entre novamente.');
  });

  it('5xx com mensagem de dominio chega a UI sem detalhes', () => {
    const { body } = run(new InternalServerErrorException('Nao foi possivel gerar o roteiro. Tente novamente.'));
    expect(body).toEqual({ success: false, message: 'Nao foi possivel gerar o roteiro. Tente novamente.', errors: {} });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/common/__tests__/api-exception.filter.spec.ts`
Expected: FAIL (`resolveErrorMessage` não é exportado)

- [ ] **Step 3: Implementar o filtro**

`backend-nest/src/common/api-exception.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Dados invalidos. Verifique os campos enviados.',
  401: 'Sessao expirada ou nao autenticada. Entre novamente.',
  403: 'Voce nao tem permissao para esta acao.',
  404: 'Recurso nao encontrado.',
  409: 'A solicitacao conflita com o estado atual do recurso.',
  413: 'Arquivo muito grande. O limite e 2 MB.',
};
const SERVER_ERROR_MESSAGE = 'Nao foi possivel processar a solicitacao.';

// Mensagens padrao (em ingles) do Nest, Passport, pipes e Multer, que nao devem chegar a UI.
const FRAMEWORK_MESSAGES = [
  /^Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) /,
  /^Validation failed/,
  /^Multipart: /,
  /^(Unauthorized|Forbidden|Forbidden resource|Not Found|Bad Request|Conflict|Payload Too Large|Internal Server Error|File too large|Too many files|Too many fields|Too many parts|Field name too long|Field value too long|Field name missing|Unexpected field)$/,
];

export function resolveErrorMessage(status: number, raw: unknown): string {
  const fallback = status >= 500 ? SERVER_ERROR_MESSAGE : STATUS_MESSAGES[status] ?? SERVER_ERROR_MESSAGE;
  const message =
    typeof raw === 'string' ? raw : typeof raw === 'object' && raw !== null && 'message' in raw ? (raw as { message: unknown }).message : undefined;
  if (typeof message !== 'string' || !message.trim()) return fallback;
  return FRAMEWORK_MESSAGES.some((pattern) => pattern.test(message)) ? fallback : message;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      message: resolveErrorMessage(status, raw),
      errors: status >= 500 ? {} : typeof raw === 'object' && raw !== null ? raw : { detail: raw },
    });
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend-nest && npx jest src/common/__tests__/api-exception.filter.spec.ts`
Expected: PASS (8 testes)

- [ ] **Step 5: Mensagens PT nos services**

Em `backend-nest/src/modules/auth/auth.service.ts`, no `register`, trocar:

```ts
    if (existing) throw new BadRequestException({ email: ['A user with this email already exists.'] });
```

por:

```ts
    if (existing) {
      throw new BadRequestException({
        message: 'Ja existe um usuario cadastrado com este email.',
        email: ['Ja existe um usuario cadastrado com este email.'],
      });
    }
```

e no `login`, trocar:

```ts
      throw new BadRequestException({ detail: 'Invalid credentials.', message: 'Credenciais invalidas.' });
```

por:

```ts
      throw new BadRequestException({ detail: 'Email ou senha invalidos.', message: 'Email ou senha invalidos.' });
```

Em `backend-nest/src/modules/users/users.service.ts`, trocar `throw new NotFoundException('User not found.');` por `throw new NotFoundException('Usuario nao encontrado.');`.

Em `backend-nest/src/modules/destinations/destinations.service.ts`, trocar `throw new NotFoundException('Destination not found.');` por `throw new NotFoundException('Destino nao encontrado.');`.

- [ ] **Step 6: Testes + build**

Run: `cd backend-nest && npx jest && npm run build`
Expected: todos PASS; build sem erros

- [ ] **Step 7: Commit**

```bash
git add backend-nest/src/common backend-nest/src/modules/auth/auth.service.ts backend-nest/src/modules/users/users.service.ts backend-nest/src/modules/destinations/destinations.service.ts
git commit -m "fix(backend-nest): mensagens de erro em portugues e 5xx sem detalhes internos"
```

---

## Task 4: PATCH de perfil validado e `is_profile_complete`

**Files:**
- Create: `backend-nest/src/common/validation.ts`
- Create: `backend-nest/src/modules/profiles/dto/update-traveler-dna.dto.ts`
- Create: `backend-nest/src/modules/profiles/dto/update-trip-preference.dto.ts`
- Modify: `backend-nest/src/modules/profiles/traveler-dna.controller.ts`
- Modify: `backend-nest/src/modules/profiles/trip-preferences.controller.ts`
- Modify: `backend-nest/src/modules/profiles/profiles.service.ts`
- Modify: `backend-nest/src/modules/profiles/profiles.module.ts`

Contexto: os PATCH recebiam `Partial<Dto>`, tipo que o `ValidationPipe` não enxerga. O corpo chegava cru e `{ "id": 5 }` sobrescrevia o registro de outro usuário. Comportamento verificado pelo smoke (Task 13: "PATCH DNA ignora id enviado").

- [ ] **Step 1: Helper de validação condicional**

`backend-nest/src/common/validation.ts`:

```ts
/** Para DTOs de PATCH: valida o campo so quando ele foi enviado (null continua invalido). */
export const isDefined = (_object: object, value: unknown): boolean => value !== undefined;
```

- [ ] **Step 2: DTOs de update**

`backend-nest/src/modules/profiles/dto/update-traveler-dna.dto.ts`:

```ts
import { IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateTravelerDnaDto {
  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(80)
  travel_style?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  pace?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  comfort_level?: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  social_energy?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  adventure_level?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  food_focus?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  cultural_interest?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  nature_interest?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(10)
  nightlife_interest?: number;

  @ValidateIf(isDefined)
  @IsString()
  notes?: string;
}
```

`backend-nest/src/modules/profiles/dto/update-trip-preference.dto.ts`:

```ts
import { IsArray, IsInt, IsNumber, IsObject, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateTripPreferenceDto {
  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  budget_min?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  budget_max?: number;

  @ValidateIf(isDefined)
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  companionship?: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(60)
  preferred_trip_length_days?: number;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(20)
  travel_month?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  hotel_level?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(40)
  transportation_style?: string;

  @ValidateIf(isDefined)
  @IsArray()
  @IsString({ each: true })
  dietary_preferences?: string[];

  @ValidateIf(isDefined)
  @IsArray()
  @IsString({ each: true })
  accessibility_needs?: string[];

  @ValidateIf(isDefined)
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ValidateIf(isDefined)
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 3: Controllers usam os DTOs**

`backend-nest/src/modules/profiles/traveler-dna.controller.ts`:

```ts
import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfilesService } from './profiles.service';
import { TravelerDnaDto } from './dto/traveler-dna.dto';
import { UpdateTravelerDnaDto } from './dto/update-traveler-dna.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/traveler-dna')
@UseGuards(JwtAuthGuard)
export class TravelerDnaController {
  constructor(private readonly profiles: ProfilesService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async getRoot(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.profiles.getDna(user.id);
    return this.response.withMessage('Registro carregado com sucesso.').build(profile);
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.getRoot(user);
  }

  @Patch()
  async patchRoot(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTravelerDnaDto) {
    const profile = await this.profiles.upsertDna(user.id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(profile);
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTravelerDnaDto) {
    return this.patchRoot(user, dto);
  }

  @Put('me')
  async putMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: TravelerDnaDto) {
    return this.patchRoot(user, dto);
  }
}
```

`backend-nest/src/modules/profiles/trip-preferences.controller.ts`:

```ts
import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfilesService } from './profiles.service';
import { TripPreferenceDto } from './dto/trip-preference.dto';
import { UpdateTripPreferenceDto } from './dto/update-trip-preference.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/trip-preferences')
@UseGuards(JwtAuthGuard)
export class TripPreferencesController {
  constructor(private readonly profiles: ProfilesService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async getRoot(@CurrentUser() user: AuthenticatedUser) {
    const preference = await this.profiles.getTripPreference(user.id);
    return this.response.withMessage('Registro carregado com sucesso.').build(preference);
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.getRoot(user);
  }

  @Patch()
  async patchRoot(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTripPreferenceDto) {
    const preference = await this.profiles.upsertTripPreference(user.id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(preference);
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTripPreferenceDto) {
    return this.patchRoot(user, dto);
  }

  @Put('me')
  async putMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: TripPreferenceDto) {
    return this.patchRoot(user, dto);
  }
}
```

- [ ] **Step 4: Service com campos obrigatórios na criação e `is_profile_complete`**

`backend-nest/src/modules/profiles/profiles.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelerDnaProfile, UserTripPreference } from './entities';
import { UpdateTravelerDnaDto } from './dto/update-traveler-dna.dto';
import { UpdateTripPreferenceDto } from './dto/update-trip-preference.dto';
import { AuditService } from '../audit/audit.service';
import { User } from '../users/user.entity';

const REQUIRED_DNA_FIELDS = [
  'travel_style',
  'pace',
  'comfort_level',
  'social_energy',
  'adventure_level',
  'food_focus',
  'cultural_interest',
  'nature_interest',
  'nightlife_interest',
] as const;
const REQUIRED_TRIP_FIELDS = ['budget_min', 'budget_max', 'preferred_trip_length_days'] as const;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(TravelerDnaProfile) private readonly dnaProfiles: Repository<TravelerDnaProfile>,
    @InjectRepository(UserTripPreference) private readonly tripPreferences: Repository<UserTripPreference>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  getDna(userId: number): Promise<TravelerDnaProfile | null> {
    return this.dnaProfiles.findOne({ where: { user: { id: userId } } });
  }

  async upsertDna(userId: number, dto: UpdateTravelerDnaDto): Promise<TravelerDnaProfile> {
    const current = await this.getDna(userId);
    if (!current && REQUIRED_DNA_FIELDS.some((field) => dto[field] === undefined)) {
      throw new BadRequestException('Responda todas as etapas do perfil de viajante antes de salvar.');
    }
    const profile = this.dnaProfiles.create({ ...(current ?? {}), ...dto, user: { id: userId } as never, notes: dto.notes ?? current?.notes ?? '' });
    const saved = await this.dnaProfiles.save(profile);
    await this.audit.log({ event_type: `traveler-dna.${current ? 'updated' : 'created'}`, actor_id: userId, content_type: 'TravelerDnaProfile', object_id: String(saved.id) });
    await this.syncProfileCompletion(userId);
    return saved;
  }

  getTripPreference(userId: number): Promise<UserTripPreference | null> {
    return this.tripPreferences.findOne({ where: { user: { id: userId } } });
  }

  async upsertTripPreference(userId: number, dto: UpdateTripPreferenceDto): Promise<UserTripPreference> {
    const current = await this.getTripPreference(userId);
    if (!current && REQUIRED_TRIP_FIELDS.some((field) => dto[field] === undefined)) {
      throw new BadRequestException('Informe orcamento e duracao da viagem antes de salvar.');
    }
    const min = dto.budget_min ?? (current ? Number(current.budget_min) : undefined);
    const max = dto.budget_max ?? (current ? Number(current.budget_max) : undefined);
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException('O orcamento minimo nao pode ser maior que o maximo.');
    }
    const preference = this.tripPreferences.create({
      ...(current ?? {}),
      ...dto,
      budget_min: dto.budget_min !== undefined ? String(dto.budget_min) : current?.budget_min,
      budget_max: dto.budget_max !== undefined ? String(dto.budget_max) : current?.budget_max,
      user: { id: userId } as never,
      companionship: dto.companionship ?? current?.companionship ?? '',
      travel_month: dto.travel_month ?? current?.travel_month ?? '',
      hotel_level: dto.hotel_level ?? current?.hotel_level ?? '',
      transportation_style: dto.transportation_style ?? current?.transportation_style ?? '',
      dietary_preferences: dto.dietary_preferences ?? current?.dietary_preferences ?? [],
      accessibility_needs: dto.accessibility_needs ?? current?.accessibility_needs ?? [],
      interests: dto.interests ?? current?.interests ?? [],
      metadata: dto.metadata ?? current?.metadata ?? {},
    });
    const saved = await this.tripPreferences.save(preference);
    await this.audit.log({ event_type: `trip-preferences.${current ? 'updated' : 'created'}`, actor_id: userId, content_type: 'UserTripPreference', object_id: String(saved.id) });
    await this.syncProfileCompletion(userId);
    return saved;
  }

  /** O front mostra "Perfil incompleto" ate o usuario ter DNA e preferencias. */
  private async syncProfileCompletion(userId: number): Promise<void> {
    const [dna, preference] = await Promise.all([this.getDna(userId), this.getTripPreference(userId)]);
    if (dna && preference) {
      await this.users.update({ id: userId, is_profile_complete: false }, { is_profile_complete: true });
    }
  }
}
```

- [ ] **Step 5: Registrar `User` no módulo**

`backend-nest/src/modules/profiles/profiles.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelerDnaProfile, UserTripPreference } from './entities';
import { User } from '../users/user.entity';
import { ProfilesService } from './profiles.service';
import { TravelerDnaController } from './traveler-dna.controller';
import { TripPreferencesController } from './trip-preferences.controller';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([TravelerDnaProfile, UserTripPreference, User]), AuditModule],
  providers: [ProfilesService, ApiResponseBuilder],
  controllers: [TravelerDnaController, TripPreferencesController],
  exports: [ProfilesService, TypeOrmModule],
})
export class ProfilesModule {}
```

- [ ] **Step 6: Build + testes**

Run: `cd backend-nest && npm run build && npx jest`
Expected: build sem erros; testes PASS

- [ ] **Step 7: Commit**

```bash
git add backend-nest/src/common/validation.ts backend-nest/src/modules/profiles
git commit -m "fix(backend-nest): valida PATCH de perfil e marca is_profile_complete"
```

---

## Task 5: Regras puras de roteiro (defaults de criação e visibilidade)

**Files:**
- Create: `backend-nest/src/modules/itineraries/itinerary-rules.ts`
- Create: `backend-nest/src/modules/itineraries/__tests__/itinerary-rules.spec.ts`

- [ ] **Step 1: Escrever o teste**

`backend-nest/src/modules/itineraries/__tests__/itinerary-rules.spec.ts`:

```ts
import { canReviewItinerary, canViewItinerary, isPublicItinerary, resolveItineraryDefaults } from '../itinerary-rules';

const preferences = { preferred_trip_length_days: 4, budget_min: '2000.00', budget_max: '6000.00', currency_code: 'EUR' };

describe('resolveItineraryDefaults', () => {
  it('usa as preferencias quando o front manda so destino e titulo', () => {
    expect(resolveItineraryDefaults({ title: 'Lisboa' }, preferences, 'Lisbon')).toEqual({
      title: 'Lisboa',
      duration_days: 4,
      budget_total: '4000.00',
      currency_code: 'EUR',
    });
  });

  it('valores enviados vencem as preferencias', () => {
    expect(resolveItineraryDefaults({ title: 'X', duration_days: 7, budget_total: 1500, currency_code: 'brl' }, preferences, 'Lisbon')).toEqual({
      title: 'X',
      duration_days: 7,
      budget_total: '1500.00',
      currency_code: 'BRL',
    });
  });

  it('sem preferencias usa 5 dias, orcamento zero e BRL', () => {
    expect(resolveItineraryDefaults({}, null, 'Tokyo')).toEqual({ title: 'Roteiro Tokyo', duration_days: 5, budget_total: '0.00', currency_code: 'BRL' });
  });

  it('ignora duracao fora de 1 a 60 e titulo em branco', () => {
    expect(resolveItineraryDefaults({ title: '   ' }, { ...preferences, preferred_trip_length_days: 0 }, 'Rio').duration_days).toBe(5);
    expect(resolveItineraryDefaults({ title: '   ' }, { ...preferences, preferred_trip_length_days: 90 }, 'Rio')).toMatchObject({ title: 'Roteiro Rio', duration_days: 5 });
  });
});

describe('visibilidade de roteiros', () => {
  const ready = { generation_status: 'ready', metadata: {}, review_stats: { review_count: 0 } };

  it('roteiro pronto sem avaliacoes e privado', () => {
    expect(isPublicItinerary(ready)).toBe(false);
    expect(canViewItinerary(ready, false)).toBe(false);
    expect(canViewItinerary(ready, true)).toBe(true);
  });

  it('avaliado ou template vira publico', () => {
    expect(isPublicItinerary({ ...ready, review_stats: { review_count: 1 } })).toBe(true);
    expect(isPublicItinerary({ ...ready, review_stats: null, metadata: { is_template: true } })).toBe(true);
  });

  it('rascunho nunca e publico nem avaliavel', () => {
    const draft = { generation_status: 'draft', metadata: { is_template: true }, review_stats: { review_count: 3 } };
    expect(isPublicItinerary(draft)).toBe(false);
    expect(canReviewItinerary(draft, true)).toBe(false);
  });

  it('dono avalia o proprio roteiro pronto; visitante so se publico', () => {
    expect(canReviewItinerary(ready, true)).toBe(true);
    expect(canReviewItinerary(ready, false)).toBe(false);
    expect(canReviewItinerary({ ...ready, review_stats: { review_count: 2 } }, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/modules/itineraries/__tests__/itinerary-rules.spec.ts`
Expected: FAIL com `Cannot find module '../itinerary-rules'`

- [ ] **Step 3: Implementar**

`backend-nest/src/modules/itineraries/itinerary-rules.ts`:

```ts
export const DEFAULT_DURATION_DAYS = 5;

export interface ItineraryDefaultsInput {
  title?: string;
  duration_days?: number;
  budget_total?: number;
  currency_code?: string;
}

export interface TripPreferenceDefaults {
  preferred_trip_length_days: number;
  budget_min: string | number;
  budget_max: string | number;
  currency_code: string;
}

export interface ItineraryDefaults {
  title: string;
  duration_days: number;
  budget_total: string;
  currency_code: string;
}

/** Completa o roteiro como o Django fazia em ItineraryViewSet.perform_create. */
export function resolveItineraryDefaults(
  input: ItineraryDefaultsInput,
  preferences: TripPreferenceDefaults | null,
  destinationName: string,
): ItineraryDefaults {
  const preferredDays = preferences?.preferred_trip_length_days ?? 0;
  const durationFromPreferences = preferredDays >= 1 && preferredDays <= 60 ? preferredDays : DEFAULT_DURATION_DAYS;
  const budgetFromPreferences = preferences ? (Number(preferences.budget_min) + Number(preferences.budget_max)) / 2 : 0;
  const budget = input.budget_total ?? budgetFromPreferences;
  return {
    title: input.title?.trim() || `Roteiro ${destinationName}`,
    duration_days: input.duration_days ?? durationFromPreferences,
    budget_total: (Number.isFinite(budget) ? budget : 0).toFixed(2),
    currency_code: (input.currency_code ?? preferences?.currency_code ?? 'BRL').toUpperCase(),
  };
}

export interface ItineraryVisibility {
  generation_status: string;
  metadata?: Record<string, unknown> | null;
  review_stats?: { review_count: number } | null;
}

/** Publico = pronto e (avaliado ou template). A resposta nunca inclui dados do dono. */
export function isPublicItinerary(itinerary: ItineraryVisibility): boolean {
  if (itinerary.generation_status !== 'ready') return false;
  return (itinerary.review_stats?.review_count ?? 0) > 0 || itinerary.metadata?.is_template === true;
}

export function canViewItinerary(itinerary: ItineraryVisibility, isOwner: boolean): boolean {
  return isOwner || isPublicItinerary(itinerary);
}

export function canReviewItinerary(itinerary: ItineraryVisibility, isOwner: boolean): boolean {
  return itinerary.generation_status === 'ready' && canViewItinerary(itinerary, isOwner);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend-nest && npx jest src/modules/itineraries/__tests__/itinerary-rules.spec.ts`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add backend-nest/src/modules/itineraries/itinerary-rules.ts backend-nest/src/modules/itineraries/__tests__/itinerary-rules.spec.ts
git commit -m "feat(backend-nest): regras de defaults e visibilidade de roteiros"
```

---

## Task 6: Roteiros — criação com defaults, PATCH, detalhe público e ranking

**Files:**
- Modify: `backend-nest/src/modules/itineraries/dto/create-itinerary.dto.ts`
- Create: `backend-nest/src/modules/itineraries/dto/update-itinerary.dto.ts`
- Modify: `backend-nest/src/modules/itineraries/itineraries.service.ts`
- Modify: `backend-nest/src/modules/itineraries/itineraries.controller.ts`
- Modify: `backend-nest/src/modules/itineraries/itineraries.module.ts`

- [ ] **Step 1: DTO de criação (duração e título opcionais)**

`backend-nest/src/modules/itineraries/dto/create-itinerary.dto.ts`:

```ts
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

export class CreateItineraryDto {
  @IsInt()
  destination!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  duration_days?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_total?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;
}
```

- [ ] **Step 2: DTO de PATCH**

`backend-nest/src/modules/itineraries/dto/update-itinerary.dto.ts`:

```ts
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateItineraryDto {
  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(160)
  title?: string;

  @ValidateIf(isDefined)
  @IsString()
  summary?: string;

  // Datas aceitam null para limpar o campo.
  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsDateString()
  end_date?: string | null;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(60)
  duration_days?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  budget_total?: number;

  @ValidateIf(isDefined)
  @IsString()
  @Length(3, 3)
  currency_code?: string;
}
```

- [ ] **Step 3: Service**

`backend-nest/src/modules/itineraries/itineraries.service.ts` (reviews continuam aqui até a Task 12):

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FavoriteItinerary, Itinerary, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { Destination } from '../destinations/entities';
import { UserTripPreference } from '../profiles/entities';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateSharedLinkDto } from './dto/create-shared-link.dto';
import { AuditService } from '../audit/audit.service';
import { AuditedServiceDecorator } from '../../common/decorators/audited-service.decorator';
import { canViewItinerary, resolveItineraryDefaults } from './itinerary-rules';

const RANKING_LIMIT = 10;

function toDateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(ItineraryDay) private readonly days: Repository<ItineraryDay>,
    @InjectRepository(FavoriteItinerary) private readonly favorites: Repository<FavoriteItinerary>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewStat) private readonly reviewStats: Repository<ReviewStat>,
    @InjectRepository(SharedItineraryLink) private readonly sharedLinks: Repository<SharedItineraryLink>,
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(UserTripPreference) private readonly tripPreferences: Repository<UserTripPreference>,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: number): Promise<Itinerary[]> {
    return this.itineraries.find({
      where: { user: { id: userId } },
      relations: { destination: true, days: { events: true }, review_stats: true },
      order: { created_at: 'DESC' },
    });
  }

  async findForUser(id: number, userId: number): Promise<Itinerary> {
    const itinerary = await this.itineraries.findOne({
      where: { id, user: { id: userId } },
      relations: { destination: true, days: { events: { poi: true } }, review_stats: true },
      order: { days: { day_number: 'ASC', events: { order_index: 'ASC' } } },
    });
    if (!itinerary) throw new NotFoundException('Roteiro nao encontrado.');
    return itinerary;
  }

  /** Dono ve sempre; os demais so roteiros publicos (prontos e avaliados ou templates). */
  async findVisibleForUser(id: number, userId: number): Promise<{ itinerary: Itinerary; isOwner: boolean }> {
    const itinerary = await this.itineraries.findOne({
      where: { id },
      relations: { destination: true, days: { events: { poi: true } }, review_stats: true },
      order: { days: { day_number: 'ASC', events: { order_index: 'ASC' } } },
    });
    const isOwner = itinerary ? await this.itineraries.exists({ where: { id, user: { id: userId } } }) : false;
    if (!itinerary || !canViewItinerary(itinerary, isOwner)) throw new NotFoundException('Roteiro nao encontrado.');
    return { itinerary, isOwner };
  }

  async create(userId: number, dto: CreateItineraryDto): Promise<Itinerary> {
    const destination = await this.destinations.findOne({ where: { id: dto.destination } });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    const preferences = await this.tripPreferences.findOne({ where: { user: { id: userId } } });
    const defaults = resolveItineraryDefaults(dto, preferences, destination.name);
    const itinerary = await this.itineraries.save(
      this.itineraries.create({
        user: { id: userId } as never,
        destination: { id: destination.id } as never,
        title: defaults.title,
        summary: dto.summary ?? '',
        start_date: toDateOnly(dto.start_date),
        end_date: toDateOnly(dto.end_date),
        duration_days: defaults.duration_days,
        budget_total: defaults.budget_total,
        currency_code: defaults.currency_code,
        generation_status: 'draft',
        generation_context: {},
        metadata: {},
      }),
    );
    await this.audit.log({ event_type: 'itinerary.created', actor_id: userId, content_type: 'Itinerary', object_id: String(itinerary.id) });
    return this.findForUser(itinerary.id, userId);
  }

  async update(id: number, userId: number, dto: UpdateItineraryDto): Promise<Itinerary> {
    const itinerary = await this.findForUser(id, userId);
    const startDate = dto.start_date !== undefined ? toDateOnly(dto.start_date) : itinerary.start_date;
    const endDate = dto.end_date !== undefined ? toDateOnly(dto.end_date) : itinerary.end_date;
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('A data final nao pode ser anterior a data inicial.');
    }
    const changes: QueryDeepPartialEntity<Itinerary> = {};
    if (dto.title !== undefined) changes.title = dto.title.trim() || itinerary.title;
    if (dto.summary !== undefined) changes.summary = dto.summary;
    if (dto.start_date !== undefined) changes.start_date = startDate;
    if (dto.end_date !== undefined) changes.end_date = endDate;
    if (dto.duration_days !== undefined) changes.duration_days = dto.duration_days;
    if (dto.budget_total !== undefined) changes.budget_total = dto.budget_total.toFixed(2);
    if (dto.currency_code !== undefined) changes.currency_code = dto.currency_code.toUpperCase();
    if (Object.keys(changes).length > 0) await this.itineraries.update({ id: itinerary.id }, changes);
    return this.findForUser(id, userId);
  }

  async markGenerating(id: number, userId: number): Promise<Itinerary> {
    const itinerary = await this.findForUser(id, userId);
    itinerary.generation_status = 'generating';
    return this.itineraries.save(itinerary);
  }

  templates(): Promise<Itinerary[]> {
    return this.itineraries.find({
      where: { generation_status: 'ready', metadata: Raw((alias) => `${alias} @> '{"is_template": true}'::jsonb`) },
      relations: { destination: true, days: { events: true }, review_stats: true },
      order: { updated_at: 'DESC' },
      take: RANKING_LIMIT,
    });
  }

  /** Paridade com o Django: so roteiros prontos e avaliados, melhor media primeiro. */
  topRated(): Promise<Itinerary[]> {
    return this.itineraries
      .createQueryBuilder('itinerary')
      .innerJoinAndSelect('itinerary.review_stats', 'stats')
      .leftJoinAndSelect('itinerary.destination', 'destination')
      .where('itinerary.generation_status = :status', { status: 'ready' })
      .andWhere('stats.review_count > 0')
      .orderBy('stats.average_rating', 'DESC')
      .addOrderBy('stats.review_count', 'DESC')
      .addOrderBy('itinerary.updated_at', 'DESC')
      .limit(RANKING_LIMIT)
      .getMany();
  }

  async daysForItinerary(id: number, userId: number): Promise<ItineraryDay[]> {
    await this.findForUser(id, userId);
    return this.days.find({ where: { itinerary: { id } }, relations: { events: { poi: true } }, order: { day_number: 'ASC', events: { order_index: 'ASC' } } });
  }

  async dayDetail(id: number, dayNumber: number, userId: number): Promise<ItineraryDay> {
    await this.findForUser(id, userId);
    const day = await this.days.findOne({ where: { itinerary: { id }, day_number: dayNumber }, relations: { events: { poi: true } } });
    if (!day) throw new NotFoundException('Dia do roteiro nao encontrado.');
    return day;
  }

  listFavorites(userId: number): Promise<FavoriteItinerary[]> {
    return this.favorites.find({ where: { user: { id: userId } }, relations: { itinerary: { destination: true } }, order: { created_at: 'DESC' } });
  }

  async createFavorite(userId: number, dto: CreateFavoriteDto): Promise<FavoriteItinerary> {
    const operation = new AuditedServiceDecorator<[CreateFavoriteDto], FavoriteItinerary>(
      {
        execute: (input) =>
          this.favorites.save(
            this.favorites.create({
              user: { id: userId } as never,
              itinerary: { id: input.itinerary } as never,
            }),
          ),
      },
      this.audit,
      'itinerary.favorited',
      () => userId,
      ([input]) => ({ itinerary_id: input.itinerary }),
    );
    return operation.execute(dto);
  }

  listReviews(itinerary?: number): Promise<Review[]> {
    return this.reviews.find({
      where: itinerary ? { itinerary: { id: itinerary } } : {},
      relations: { itinerary: true, user: true },
      order: { created_at: 'DESC' },
    });
  }

  async createReview(userId: number, dto: CreateReviewDto): Promise<Review> {
    const review = await this.reviews.save(
      this.reviews.create({
        user: { id: userId } as never,
        itinerary: { id: dto.itinerary } as never,
        rating: dto.rating,
        title: dto.title ?? '',
        body: dto.body ?? '',
      }),
    );
    const stats = await this.reviews
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'count')
      .addSelect('AVG(review.rating)', 'average')
      .where('review.itinerary_id = :itineraryId', { itineraryId: dto.itinerary })
      .getRawOne<{ count: string; average: string }>();
    const existing = await this.reviewStats.findOne({ where: { itinerary: { id: dto.itinerary } } });
    await this.reviewStats.save(
      this.reviewStats.create({
        ...(existing ?? {}),
        itinerary: { id: dto.itinerary } as never,
        review_count: Number(stats?.count ?? 0),
        average_rating: Number(stats?.average ?? 0).toFixed(2),
      }),
    );
    await this.audit.log({ event_type: 'review.created', actor_id: userId, content_type: 'Itinerary', object_id: String(dto.itinerary), metadata: { rating: dto.rating } });
    return review;
  }

  listSharedLinks(userId: number): Promise<SharedItineraryLink[]> {
    return this.sharedLinks.find({ where: { created_by: { id: userId } }, relations: { itinerary: true }, order: { created_at: 'DESC' } });
  }

  async createSharedLink(userId: number, dto: CreateSharedLinkDto): Promise<SharedItineraryLink> {
    const link = await this.sharedLinks.save(
      this.sharedLinks.create({
        created_by: { id: userId } as never,
        itinerary: { id: dto.itinerary } as never,
        token: randomUUID(),
        expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
        is_active: true,
      }),
    );
    await this.audit.log({ event_type: 'itinerary.shared', actor_id: userId, content_type: 'Itinerary', object_id: String(dto.itinerary), metadata: { token: link.token } });
    return link;
  }
}
```

- [ ] **Step 4: Controller**

`backend-nest/src/modules/itineraries/itineraries.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { ItineraryGenerationFacade } from '../../common/facades/itinerary-generation.facade';

@Controller('api/itineraries')
export class ItinerariesController {
  constructor(
    private readonly itineraries: ItinerariesService,
    private readonly generation: ItineraryGenerationFacade,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Get('templates')
  async templates() {
    const itineraries = await this.itineraries.templates();
    return this.response.withMessage('Templates de roteiros carregados com sucesso.').build(itineraries);
  }

  @Get('top-rated')
  async topRated() {
    const itineraries = await this.itineraries.topRated();
    return this.response.withMessage('Ranking de roteiros mais bem avaliados carregado com sucesso.').build(itineraries);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: AuthenticatedUser) {
    const itineraries = await this.itineraries.listForUser(user.id);
    return this.response.withMessage('Lista carregada com sucesso.').build(itineraries);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateItineraryDto) {
    const itinerary = await this.itineraries.create(user.id, dto);
    return this.response.withMessage('Registro criado com sucesso.').build(itinerary);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async retrieve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const { itinerary, isOwner } = await this.itineraries.findVisibleForUser(id, user.id);
    return this.response.withMessage('Registro carregado com sucesso.').build({ ...itinerary, is_owner: isOwner });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItineraryDto) {
    const itinerary = await this.itineraries.update(id, user.id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build({ ...itinerary, is_owner: true });
  }

  @Post(':id/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const itinerary = await this.itineraries.markGenerating(id, user.id);
    await this.generation.generate(itinerary, user.id);
    const generated = await this.itineraries.findForUser(id, user.id);
    return this.response.withMessage('Geracao de itinerario iniciada.').build(generated);
  }

  @Get(':id/days')
  @UseGuards(JwtAuthGuard)
  async days(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const days = await this.itineraries.daysForItinerary(id, user.id);
    return this.response.withMessage('Programacao do roteiro carregada com sucesso.').build(days);
  }

  @Get(':id/days/:dayNumber')
  @UseGuards(JwtAuthGuard)
  async dayDetail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Param('dayNumber', ParseIntPipe) dayNumber: number) {
    const day = await this.itineraries.dayDetail(id, dayNumber, user.id);
    return this.response.withMessage('Programacao do dia carregada com sucesso.').build(day);
  }
}
```

- [ ] **Step 5: Module**

`backend-nest/src/modules/itineraries/itineraries.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteItinerary, Itinerary, ItineraryDailyEvent, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { Destination } from '../destinations/entities';
import { UserTripPreference } from '../profiles/entities';
import { ItinerariesService } from './itineraries.service';
import { ItinerariesController } from './itineraries.controller';
import { FavoritesController } from './favorites.controller';
import { ReviewsController } from './reviews.controller';
import { SharedLinksController } from './shared-links.controller';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Itinerary,
      ItineraryDay,
      ItineraryDailyEvent,
      FavoriteItinerary,
      Review,
      ReviewStat,
      SharedItineraryLink,
      Destination,
      UserTripPreference,
    ]),
    AuditModule,
    AiModule,
  ],
  providers: [ItinerariesService, ApiResponseBuilder],
  controllers: [ItinerariesController, FavoritesController, ReviewsController, SharedLinksController],
  exports: [ItinerariesService, TypeOrmModule],
})
export class ItinerariesModule {}
```

- [ ] **Step 6: Build, testes e lint**

Run: `cd backend-nest && npm run build && npx jest && npm run lint`
Expected: build sem erros; testes PASS; lint sem warnings

- [ ] **Step 7: Commit**

```bash
git add backend-nest/src/modules/itineraries
git commit -m "feat(backend-nest): roteiro com defaults, PATCH, detalhe publico e ranking real"
```

---

## Task 7: Scoring de sugestão de destino

**Files:**
- Create: `backend-nest/src/modules/destinations/destination-suggestion.ts`
- Create: `backend-nest/src/modules/destinations/__tests__/destination-suggestion.spec.ts`

- [ ] **Step 1: Escrever o teste**

`backend-nest/src/modules/destinations/__tests__/destination-suggestion.spec.ts`:

```ts
import { pickSuggestedDestination } from '../destination-suggestion';

const tag = (slug: string) => ({ slug });
const lisbon = {
  id: 1,
  name: 'Lisbon',
  average_rating: '4.70',
  pois: [
    { poi_type: 'attraction', tags: [tag('cultura'), tag('historia')] },
    { poi_type: 'restaurant', tags: [tag('gastronomia')] },
    { poi_type: 'activity', tags: [tag('cultura')] },
  ],
};
const rio = {
  id: 3,
  name: 'Rio de Janeiro',
  average_rating: '4.60',
  pois: [
    { poi_type: 'attraction', tags: [tag('natureza')] },
    { poi_type: 'activity', tags: [tag('natureza')] },
    { poi_type: 'lodging', tags: [tag('praia')] },
  ],
};
const tokyo = { id: 2, name: 'Tokyo', average_rating: '4.80', pois: [] };

const culturalDna = { cultural_interest: 10, food_focus: 6, nature_interest: 2, nightlife_interest: 2, adventure_level: 3 };
const natureDna = { cultural_interest: 2, food_focus: 3, nature_interest: 10, nightlife_interest: 2, adventure_level: 8 };

describe('pickSuggestedDestination', () => {
  it('escolhe destino cultural para perfil cultural', () => {
    expect(pickSuggestedDestination([rio, lisbon, tokyo], culturalDna, { interests: ['culture'] }, [])?.destination.name).toBe('Lisbon');
  });

  it('escolhe natureza para perfil aventureiro', () => {
    expect(pickSuggestedDestination([lisbon, rio, tokyo], natureDna, { interests: ['nature'] }, [])?.destination.name).toBe('Rio de Janeiro');
  });

  it('evita destinos ja usados pelo usuario', () => {
    expect(pickSuggestedDestination([lisbon, rio, tokyo], culturalDna, null, [1])?.destination.name).toBe('Rio de Janeiro');
  });

  it('volta a considerar todos quando todos ja foram usados', () => {
    expect(pickSuggestedDestination([lisbon], culturalDna, null, [1])?.destination.name).toBe('Lisbon');
  });

  it('sem perfil desempata pela avaliacao', () => {
    const a = { id: 10, name: 'A', average_rating: '4.10', pois: [] };
    const b = { id: 11, name: 'B', average_rating: '4.90', pois: [] };
    expect(pickSuggestedDestination([a, b], null, null, [])?.destination.name).toBe('B');
  });

  it('retorna null sem candidatos', () => {
    expect(pickSuggestedDestination([], culturalDna, null, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/modules/destinations`
Expected: FAIL com `Cannot find module '../destination-suggestion'`

- [ ] **Step 3: Implementar**

`backend-nest/src/modules/destinations/destination-suggestion.ts`:

```ts
import { Destination, PointOfInterest } from './entities';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';

type Category = 'culture' | 'food' | 'nature' | 'nightlife' | 'shopping' | 'wellness' | 'adventure';

type PoiLike = Pick<PointOfInterest, 'poi_type'> & { tags?: Array<{ slug: string }> | null };
export type SuggestionCandidate = Pick<Destination, 'id' | 'name' | 'average_rating'> & { pois?: PoiLike[] | null };
export type SuggestionProfile = Pick<
  TravelerDnaProfile,
  'cultural_interest' | 'food_focus' | 'nature_interest' | 'nightlife_interest' | 'adventure_level'
> | null;
export type SuggestionPreferences = Pick<UserTripPreference, 'interests'> | null;

const hasTag = (poi: PoiLike, ...slugs: string[]) => (poi.tags ?? []).some((tag) => slugs.includes(tag.slug));

// Interesses do onboarding (food, culture, ...) -> POIs que os atendem (tags do seed).
const CATEGORY_MATCHERS: Record<Category, (poi: PoiLike) => boolean> = {
  culture: (poi) => hasTag(poi, 'cultura', 'historia'),
  food: (poi) => hasTag(poi, 'gastronomia'),
  nature: (poi) => hasTag(poi, 'natureza', 'praia'),
  nightlife: (poi) => hasTag(poi, 'noturno'),
  shopping: (poi) => hasTag(poi, 'compras'),
  wellness: (poi) => hasTag(poi, 'praia'),
  adventure: (poi) => poi.poi_type === 'activity',
};
const CATEGORIES = Object.keys(CATEGORY_MATCHERS) as Category[];

function categoryWeights(profile: SuggestionProfile, preferences: SuggestionPreferences): Record<Category, number> {
  const scale = (value: number | undefined) => (profile && value !== undefined ? value / 10 : 0.5);
  const weights: Record<Category, number> = {
    culture: scale(profile?.cultural_interest),
    food: scale(profile?.food_focus),
    nature: scale(profile?.nature_interest),
    nightlife: scale(profile?.nightlife_interest),
    adventure: scale(profile?.adventure_level),
    shopping: 0,
    wellness: 0,
  };
  for (const interest of preferences?.interests ?? []) {
    if (interest in weights) weights[interest as Category] += 0.5;
  }
  return weights;
}

function scoreDestination(destination: SuggestionCandidate, weights: Record<Category, number>): number {
  const pois = destination.pois ?? [];
  const affinity = CATEGORIES.reduce((total, category) => {
    const matches = pois.filter(CATEGORY_MATCHERS[category]).length;
    return total + weights[category] * Math.min(1, matches / 2);
  }, 0);
  return affinity + (0.5 * (Number(destination.average_rating) || 0)) / 5;
}

/** Destino com maior afinidade com DNA/interesses, evitando os ja usados pelo usuario. */
export function pickSuggestedDestination<T extends SuggestionCandidate>(
  candidates: T[],
  profile: SuggestionProfile,
  preferences: SuggestionPreferences,
  usedDestinationIds: number[],
): { destination: T; score: number } | null {
  const fresh = candidates.filter((item) => !usedDestinationIds.includes(Number(item.id)));
  const pool = fresh.length > 0 ? fresh : candidates;
  const weights = categoryWeights(profile, preferences);
  const ranked = pool
    .map((destination) => ({ destination, score: scoreDestination(destination, weights) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.destination.average_rating) - Number(a.destination.average_rating) ||
        a.destination.name.localeCompare(b.destination.name, 'pt-BR'),
    );
  return ranked[0] ?? null;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend-nest && npx jest src/modules/destinations`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add backend-nest/src/modules/destinations/destination-suggestion.ts backend-nest/src/modules/destinations/__tests__
git commit -m "feat(backend-nest): scoring de sugestao de destino pelo perfil"
```

---

## Task 8: Endpoint `POST /api/destinations/suggest`

**Files:**
- Create: `backend-nest/src/modules/destinations/destination-suggestion.service.ts`
- Modify: `backend-nest/src/modules/destinations/destinations.controller.ts`
- Modify: `backend-nest/src/modules/destinations/destinations.module.ts`

- [ ] **Step 1: Service**

`backend-nest/src/modules/destinations/destination-suggestion.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from './entities';
import { DestinationsService } from './destinations.service';
import { pickSuggestedDestination } from './destination-suggestion';
import { ProfilesService } from '../profiles/profiles.service';
import { Itinerary } from '../itineraries/entities';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DestinationSuggestionService {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly profiles: ProfilesService,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    private readonly audit: AuditService,
  ) {}

  async suggest(userId: number): Promise<Destination> {
    const [candidates, profile, preferences, used] = await Promise.all([
      this.destinations.list(),
      this.profiles.getDna(userId),
      this.profiles.getTripPreference(userId),
      this.itineraries.find({ select: { id: true, destination: { id: true } }, where: { user: { id: userId } }, relations: { destination: true } }),
    ]);
    const choice = pickSuggestedDestination(candidates, profile, preferences, used.map((itinerary) => Number(itinerary.destination.id)));
    if (!choice) throw new NotFoundException('Nenhum destino disponivel para sugerir no momento.');
    await this.audit.log({
      event_type: 'destination.suggested',
      actor_id: userId,
      content_type: 'Destination',
      object_id: String(choice.destination.id),
      metadata: { score: Number(choice.score.toFixed(3)) },
    });
    return choice.destination;
  }
}
```

- [ ] **Step 2: Controller**

`backend-nest/src/modules/destinations/destinations.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DestinationsService } from './destinations.service';
import { DestinationDiscoveryFacade } from './destination-discovery.facade';
import { DestinationSuggestionService } from './destination-suggestion.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

interface MaybeAuthRequest extends Request {
  user?: AuthenticatedUser;
}

@Controller('api/destinations')
export class DestinationsController {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly discovery: DestinationDiscoveryFacade,
    private readonly suggestions: DestinationSuggestionService,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Get()
  async list() {
    const destinations = await this.destinations.list();
    return this.response.withMessage('Lista carregada com sucesso.').build(destinations);
  }

  @Get('search')
  async search(@Query('q') q?: string, @Query('country') country?: string, @Query('city') city?: string, @Req() request?: MaybeAuthRequest) {
    const result = await this.discovery.searchOrDiscover({ q, country, city, actorId: request?.user?.id ?? null });
    return this.response
      .withMessage(result.discovered ? 'Resultados carregados (destino enriquecido).' : 'Resultados da busca carregados com sucesso.')
      .build(result.data);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async suggest(@CurrentUser() user: AuthenticatedUser) {
    const destination = await this.suggestions.suggest(user.id);
    return this.response.withMessage(`Destino sugerido com base no seu perfil: ${destination.name}.`).build(destination);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateDestinationDto) {
    const destination = await this.destinations.create(dto);
    return this.response.withMessage('Registro criado com sucesso.').build(destination);
  }

  @Get(':id')
  async retrieve(@Param('id', ParseIntPipe) id: number) {
    const destination = await this.destinations.findOne(id);
    return this.response.withMessage('Registro carregado com sucesso.').build(destination);
  }
}
```

- [ ] **Step 3: Module**

`backend-nest/src/modules/destinations/destinations.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Destination, DestinationCostProfile, PoiTag, PointOfInterest } from './entities';
import { Itinerary } from '../itineraries/entities';
import { DestinationsService } from './destinations.service';
import { DestinationsController } from './destinations.controller';
import { PoisController } from './pois.controller';
import { DestinationDiscoveryFacade } from './destination-discovery.facade';
import { DestinationSuggestionService } from './destination-suggestion.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [TypeOrmModule.forFeature([Destination, DestinationCostProfile, PoiTag, PointOfInterest, Itinerary]), AuditModule, ProfilesModule],
  providers: [DestinationsService, DestinationDiscoveryFacade, DestinationSuggestionService, ApiResponseBuilder],
  controllers: [DestinationsController, PoisController],
  exports: [DestinationsService, TypeOrmModule],
})
export class DestinationsModule {}
```

- [ ] **Step 4: Build + testes**

Run: `cd backend-nest && npm run build && npx jest`
Expected: build sem erros; testes PASS

- [ ] **Step 5: Commit**

```bash
git add backend-nest/src/modules/destinations
git commit -m "feat(backend-nest): sugestao de destino baseada no perfil"
```

---

## Task 9: Upload de avatar

**Files:**
- Create: `backend-nest/src/common/uploads.ts`
- Create: `backend-nest/src/modules/users/avatar-upload.ts`
- Create: `backend-nest/src/modules/users/__tests__/avatar-upload.spec.ts`
- Modify: `backend-nest/src/modules/users/users.service.ts`
- Modify: `backend-nest/src/modules/users/users.controller.ts`
- Modify: `backend-nest/src/main.ts`
- Create: `backend-nest/.gitignore`

- [ ] **Step 1: Escrever o teste das opções de upload**

`backend-nest/src/modules/users/__tests__/avatar-upload.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { AVATAR_MAX_BYTES, avatarUploadOptions } from '../avatar-upload';

function filter(mimetype: string) {
  const callback = jest.fn();
  avatarUploadOptions.fileFilter?.({}, { mimetype } as never, callback);
  return callback.mock.calls[0] as [Error | null, boolean];
}

describe('avatarUploadOptions', () => {
  it('aceita imagens raster', () => {
    for (const mimetype of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(filter(mimetype)).toEqual([null, true]);
    }
  });

  it('recusa svg e outros tipos com mensagem PT', () => {
    const [error, accepted] = filter('image/svg+xml');
    expect(accepted).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error?.message).toBe('Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.');
  });

  it('limita a um arquivo de ate 2 MB', () => {
    expect(avatarUploadOptions.limits).toEqual({ fileSize: AVATAR_MAX_BYTES, files: 1 });
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/modules/users`
Expected: FAIL com `Cannot find module '../avatar-upload'`

- [ ] **Step 3: Implementar opções e pasta de uploads**

`backend-nest/src/common/uploads.ts`:

```ts
import { join } from 'path';

/** Pasta servida em /uploads (fora do git). */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const UPLOADS_URL_PREFIX = '/uploads';
```

`backend-nest/src/modules/users/avatar-upload.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

// SVG fica de fora: pode carregar script e seria servido pela mesma origem da API.
export const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Arquivo em memoria entregue pelo FileInterceptor (sem storage configurado). */
export interface UploadedAvatarFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export const avatarUploadOptions: MulterOptions = {
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (AVATAR_EXTENSIONS[file.mimetype]) {
      callback(null, true);
      return;
    }
    callback(new BadRequestException('Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.'), false);
  },
};
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend-nest && npx jest src/modules/users`
Expected: PASS (3 testes)

- [ ] **Step 5: Service grava o arquivo**

Em `backend-nest/src/modules/users/users.service.ts`, adicionar aos imports:

```ts
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { AVATAR_EXTENSIONS, UploadedAvatarFile } from './avatar-upload';
import { UPLOADS_ROOT, UPLOADS_URL_PREFIX } from '../../common/uploads';
```

e adicionar o método após `update`:

```ts
  async setAvatar(id: number, file: UploadedAvatarFile, baseUrl: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario nao encontrado.');
    const directory = join(UPLOADS_ROOT, 'avatars');
    const filename = `${id}-${Date.now()}.${AVATAR_EXTENSIONS[file.mimetype]}`;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer);
    user.avatar_url = `${baseUrl}${UPLOADS_URL_PREFIX}/avatars/${filename}`;
    return this.users.save(user);
  }
```

- [ ] **Step 6: Controller**

`backend-nest/src/modules/users/users.controller.ts`:

```ts
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { presentUser } from './user.presenter';
import { UpdateUserDto } from './dto/update-user.dto';
import { avatarUploadOptions, UploadedAvatarFile } from './avatar-upload';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService, private readonly response: ApiResponseBuilder) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() authUser: AuthenticatedUser) {
    const user = await this.users.findById(authUser.id);
    return this.response.withMessage('Usuario carregado com sucesso.').build(user ? presentUser(user) : null);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() authUser: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    const user = await this.users.update(authUser.id, dto);
    return this.response.withMessage('Usuario atualizado com sucesso.').build(presentUser(user));
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @CurrentUser() authUser: AuthenticatedUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('Selecione uma imagem.');
    const user = await this.users.setAvatar(authUser.id, file, `${request.protocol}://${request.get('host')}`);
    return this.response.withMessage('Avatar atualizado com sucesso.').build(presentUser(user));
  }
}
```

- [ ] **Step 7: Servir `/uploads`**

`backend-nest/src/main.ts`:

```ts
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { UPLOADS_ROOT, UPLOADS_URL_PREFIX } from './common/uploads';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('CORS_ALLOW_ALL_ORIGINS', 'true') === 'true' ? true : config.get<string>('CORS_ALLOWED_ORIGINS', '').split(',').filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: `${UPLOADS_URL_PREFIX}/`,
    setHeaders: (res: Response) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  const port = Number(config.get('PORT', 8001));
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 8: Ignorar uploads no git**

`backend-nest/.gitignore`:

```
uploads/
```

- [ ] **Step 9: Build + testes**

Run: `cd backend-nest && npm run build && npx jest`
Expected: build sem erros; testes PASS

- [ ] **Step 10: Commit**

```bash
git add backend-nest/.gitignore backend-nest/src/common/uploads.ts backend-nest/src/modules/users backend-nest/src/main.ts
git commit -m "feat(backend-nest): upload de avatar servido em /uploads"
```

---

## Task 10: Regeneração transacional e falha visível

**Files:**
- Modify: `backend-nest/src/modules/ai/ai.service.ts`
- Modify: `backend-nest/src/common/facades/itinerary-generation.facade.ts`
- Create: `backend-nest/src/common/facades/__tests__/itinerary-generation.facade.spec.ts`

- [ ] **Step 1: Escrever o teste da facade**

`backend-nest/src/common/facades/__tests__/itinerary-generation.facade.spec.ts`:

```ts
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ItineraryGenerationFacade } from '../itinerary-generation.facade';
import { AiService } from '../../../modules/ai/ai.service';
import { Itinerary } from '../../../modules/itineraries/entities';

describe('ItineraryGenerationFacade', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('marca job e roteiro como failed quando a geracao quebra', async () => {
    const ai = {
      createJob: jest.fn().mockResolvedValue({ id: 7 }),
      runJob: jest.fn().mockRejectedValue(new Error('boom')),
      markJobFailed: jest.fn().mockResolvedValue(undefined),
    };
    const facade = new ItineraryGenerationFacade(ai as unknown as AiService);

    const attempt = facade.generate({ id: 3 } as Itinerary, 1);

    await expect(attempt).rejects.toThrow(InternalServerErrorException);
    await expect(attempt).rejects.toThrow('Nao foi possivel gerar o roteiro. Tente novamente.');
    expect(ai.markJobFailed).toHaveBeenCalledWith(7, 3, 'boom');
  });

  it('devolve o job concluido quando tudo da certo', async () => {
    const job = { id: 7, status: 'completed' };
    const ai = { createJob: jest.fn().mockResolvedValue({ id: 7 }), runJob: jest.fn().mockResolvedValue(job), markJobFailed: jest.fn() };
    const facade = new ItineraryGenerationFacade(ai as unknown as AiService);

    await expect(facade.generate({ id: 3 } as Itinerary, 1)).resolves.toBe(job);
    expect(ai.markJobFailed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/common/facades`
Expected: FAIL (`markJobFailed` não é chamado; a facade só repassa o erro)

- [ ] **Step 3: Facade**

`backend-nest/src/common/facades/itinerary-generation.facade.ts`:

```ts
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Itinerary } from '../../modules/itineraries/entities';
import { LlmJob } from '../../modules/ai/entities';
import { AiService } from '../../modules/ai/ai.service';

@Injectable()
export class ItineraryGenerationFacade {
  private readonly logger = new Logger(ItineraryGenerationFacade.name);

  constructor(private readonly aiService: AiService) {}

  async generate(itinerary: Itinerary, userId: number): Promise<LlmJob> {
    const job = await this.aiService.createJob(itinerary, userId);
    try {
      return await this.aiService.runJob(job.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao gerar o roteiro ${itinerary.id}: ${reason}`, error instanceof Error ? error.stack : undefined);
      await this.aiService.markJobFailed(job.id, itinerary.id, reason);
      throw new InternalServerErrorException('Nao foi possivel gerar o roteiro. Tente novamente.');
    }
  }
}
```

- [ ] **Step 4: `runJob` transacional + `markJobFailed`**

`backend-nest/src/modules/ai/ai.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LlmJob, LlmJobLog, LlmModel, PromptTemplate } from './entities';
import { Itinerary, ItineraryDailyEvent, ItineraryDay } from '../itineraries/entities';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';
import { PointOfInterest } from '../destinations/entities';
import { ItineraryGeneratorFactory } from '../../common/factories/itinerary-generator.factory';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(LlmJob) private readonly jobs: Repository<LlmJob>,
    @InjectRepository(LlmJobLog) private readonly logs: Repository<LlmJobLog>,
    @InjectRepository(LlmModel) private readonly models: Repository<LlmModel>,
    @InjectRepository(PromptTemplate) private readonly templates: Repository<PromptTemplate>,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(TravelerDnaProfile) private readonly profiles: Repository<TravelerDnaProfile>,
    @InjectRepository(UserTripPreference) private readonly preferences: Repository<UserTripPreference>,
    @InjectRepository(PointOfInterest) private readonly pois: Repository<PointOfInterest>,
    private readonly generatorFactory: ItineraryGeneratorFactory,
  ) {}

  listModels(): Promise<LlmModel[]> {
    return this.models.find({ where: { is_active: true }, relations: { provider: true } });
  }

  listJobs(userId: number): Promise<LlmJob[]> {
    return this.jobs.find({
      where: { user: { id: userId } },
      relations: { destination: true, itinerary: true, llm_model: true, logs: true },
      order: { created_at: 'DESC' },
    });
  }

  async createJob(itinerary: Itinerary, userId: number): Promise<LlmJob> {
    const model = await this.models.findOne({ where: { is_default: true, is_active: true }, relations: { provider: true } });
    const template = await this.templates.findOne({ where: { key: 'itinerary-generation', is_active: true } });
    const job = await this.jobs.save(
      this.jobs.create({
        user: { id: userId } as never,
        itinerary,
        destination: itinerary.destination,
        llm_model: model,
        prompt_template: template,
        request_payload: { itinerary_id: itinerary.id, destination_id: itinerary.destination.id },
        status: 'queued',
      }),
    );
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job queued.', payload: {} }));
    return job;
  }

  async runJob(jobId: number): Promise<LlmJob> {
    const job = await this.jobs.findOne({
      where: { id: jobId },
      relations: { itinerary: { destination: true }, destination: true, prompt_template: true, llm_model: true, user: true },
    });
    if (!job) throw new NotFoundException('Job de geracao nao encontrado.');
    if (!job.itinerary) {
      job.status = 'failed';
      job.error_message = 'Missing itinerary.';
      return this.jobs.save(job);
    }

    job.status = 'running';
    await this.jobs.save(job);
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job started.', payload: {} }));

    const itinerary = job.itinerary;
    const profile = await this.profiles.findOne({ where: { user: { id: job.user.id } } });
    const preferences = await this.preferences.findOne({ where: { user: { id: job.user.id } } });
    const pois = await this.pois.find({ where: { destination: { id: itinerary.destination.id } }, order: { rating: 'DESC', name: 'ASC' } });
    const result = this.generatorFactory.create().generate({
      itinerary,
      profile,
      preferences,
      pois,
      promptTemplate: job.prompt_template,
    });

    // Tudo ou nada: falha no meio nao deixa o roteiro sem dias.
    await this.jobs.manager.transaction(async (manager) => {
      itinerary.title = result.title;
      itinerary.summary = result.summary;
      itinerary.budget_total = result.estimated_cost;
      itinerary.currency_code = result.currency_code;
      itinerary.generation_status = 'ready';
      itinerary.generation_context = {
        profile_id: profile?.id ?? null,
        preferences_id: preferences?.id ?? null,
        ...result.metadata,
      };
      await manager.save(itinerary);

      // As FKs do Django sao NO ACTION: eventos saem antes dos dias.
      const previousDays = await manager.find(ItineraryDay, { select: { id: true }, where: { itinerary: { id: itinerary.id } } });
      const dayIds = previousDays.map((day) => day.id);
      if (dayIds.length > 0) {
        const previousEvents = await manager.find(ItineraryDailyEvent, { select: { id: true }, where: { itinerary_day: { id: In(dayIds) } } });
        if (previousEvents.length > 0) await manager.delete(ItineraryDailyEvent, previousEvents.map((event) => event.id));
        await manager.delete(ItineraryDay, dayIds);
      }

      for (let dayIndex = 0; dayIndex < result.days.length; dayIndex += 1) {
        const dayData = result.days[dayIndex];
        const savedDay = await manager.save(
          manager.create(ItineraryDay, {
            itinerary,
            day_number: dayIndex + 1,
            title: dayData.title,
            summary: dayData.summary,
            estimated_cost: dayData.events.reduce((total, event) => total + Number(event.estimated_cost), 0).toFixed(2),
          }),
        );
        for (const event of dayData.events) {
          await manager.save(
            manager.create(ItineraryDailyEvent, {
              itinerary_day: savedDay,
              title: event.title,
              description: event.description,
              estimated_cost: event.estimated_cost,
              order_index: event.order_index,
              poi: event.poi_id ? ({ id: event.poi_id } as PointOfInterest) : null,
            }),
          );
        }
      }
    });

    job.status = 'completed';
    job.response_payload = result as unknown as Record<string, unknown>;
    const savedJob = await this.jobs.save(job);
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job completed.', payload: result.metadata }));
    return savedJob;
  }

  async markJobFailed(jobId: number, itineraryId: number, reason: string): Promise<void> {
    await this.jobs.update({ id: jobId }, { status: 'failed', error_message: reason });
    await this.itineraries.update({ id: itineraryId }, { generation_status: 'failed' });
    await this.logs.save(this.logs.create({ llm_job: { id: jobId } as LlmJob, level: 'error', message: 'Job failed.', payload: { error: reason } }));
  }
}
```

(Os repositórios `days`/`events` saíram do construtor; a escrita usa o `manager` da transação. `AiModule` continua registrando as mesmas entities.)

- [ ] **Step 5: Testes + build + lint**

Run: `cd backend-nest && npx jest && npm run build && npm run lint`
Expected: PASS; build sem erros; lint limpo

- [ ] **Step 6: Commit**

```bash
git add backend-nest/src/modules/ai/ai.service.ts backend-nest/src/common/facades
git commit -m "fix(backend-nest): regeracao de roteiro transacional e falha marcada como failed"
```

---

## Task 11: Presenter de avaliação sem dados sensíveis

**Files:**
- Create: `backend-nest/src/modules/itineraries/review.presenter.ts`
- Create: `backend-nest/src/modules/itineraries/__tests__/review.presenter.spec.ts`

- [ ] **Step 1: Escrever o teste**

`backend-nest/src/modules/itineraries/__tests__/review.presenter.spec.ts`:

```ts
import { presentReview } from '../review.presenter';
import { Review } from '../entities';

const createdAt = new Date('2026-10-01T10:00:00Z');

function review(user: Partial<Review['user']>): Review {
  return {
    id: 5,
    rating: 4,
    title: 'Bom',
    body: 'Gostei',
    created_at: createdAt,
    updated_at: createdAt,
    itinerary: { id: 9 } as Review['itinerary'],
    user: { id: 2, display_name: 'Ana', first_name: 'Ana', username: 'ana', avatar_url: '', ...user } as Review['user'],
  } as Review;
}

describe('presentReview', () => {
  it('expoe so dados publicos do autor', () => {
    const presented = presentReview(review({ email: 'ana@x.dev', password: 'pbkdf2_sha256$1$a$b', is_staff: true }));

    expect(presented).toEqual({
      id: 5,
      itinerary: 9,
      rating: 4,
      title: 'Bom',
      body: 'Gostei',
      created_at: createdAt,
      updated_at: createdAt,
      user: { id: 2, display_name: 'Ana', avatar_url: '' },
    });
    expect(JSON.stringify(presented)).not.toMatch(/password|email|pbkdf2|is_staff/);
  });

  it('usa first_name ou username quando nao ha display_name', () => {
    expect(presentReview(review({ display_name: '', first_name: 'Ana' })).user.display_name).toBe('Ana');
    expect(presentReview(review({ display_name: '', first_name: '' })).user.display_name).toBe('ana');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend-nest && npx jest src/modules/itineraries/__tests__/review.presenter.spec.ts`
Expected: FAIL com `Cannot find module '../review.presenter'`

- [ ] **Step 3: Implementar**

`backend-nest/src/modules/itineraries/review.presenter.ts`:

```ts
import { Review } from './entities';

export interface PresentedReview {
  id: number;
  itinerary: number;
  rating: number;
  title: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  user: { id: number; display_name: string; avatar_url: string };
}

/** Avaliacoes sao publicas: o autor sai reduzido (nunca senha, email ou flags). Requer relations user + itinerary. */
export function presentReview(review: Review): PresentedReview {
  const author = review.user;
  return {
    id: Number(review.id),
    itinerary: Number(review.itinerary.id),
    rating: review.rating,
    title: review.title,
    body: review.body,
    created_at: review.created_at,
    updated_at: review.updated_at,
    user: {
      id: Number(author.id),
      display_name: author.display_name || author.first_name || author.username,
      avatar_url: author.avatar_url,
    },
  };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend-nest && npx jest src/modules/itineraries/__tests__/review.presenter.spec.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add backend-nest/src/modules/itineraries/review.presenter.ts backend-nest/src/modules/itineraries/__tests__/review.presenter.spec.ts
git commit -m "feat(backend-nest): presenter de avaliacao sem dados sensiveis do autor"
```

---

## Task 12: CRUD de avaliações com regras de visibilidade

**Files:**
- Create: `backend-nest/src/modules/itineraries/reviews.service.ts`
- Create: `backend-nest/src/modules/itineraries/dto/update-review.dto.ts`
- Modify: `backend-nest/src/modules/itineraries/dto/create-review.dto.ts`
- Modify: `backend-nest/src/modules/itineraries/reviews.controller.ts`
- Modify: `backend-nest/src/modules/itineraries/itineraries.module.ts`
- Modify: `backend-nest/src/modules/itineraries/itineraries.service.ts` (remove `listReviews`/`createReview`)

- [ ] **Step 1: DTOs**

`backend-nest/src/modules/itineraries/dto/create-review.dto.ts`:

```ts
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  itinerary!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
```

`backend-nest/src/modules/itineraries/dto/update-review.dto.ts`:

```ts
import { IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { isDefined } from '../../../common/validation';

export class UpdateReviewDto {
  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(120)
  title?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(2000)
  body?: string;
}
```

- [ ] **Step 2: Service**

`backend-nest/src/modules/itineraries/reviews.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Itinerary, Review, ReviewStat } from './entities';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AuditService } from '../audit/audit.service';
import { canReviewItinerary, canViewItinerary } from './itinerary-rules';
import { PresentedReview, presentReview } from './review.presenter';

const LIST_LIMIT = 100;
const DUPLICATE_MESSAGE = 'Voce ja avaliou este roteiro.';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewStat) private readonly stats: Repository<ReviewStat>,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    private readonly audit: AuditService,
  ) {}

  async list(itineraryId?: number): Promise<PresentedReview[]> {
    const reviews = await this.reviews.find({
      where: itineraryId ? { itinerary: { id: itineraryId } } : {},
      relations: { user: true, itinerary: true },
      order: { created_at: 'DESC' },
      take: itineraryId ? undefined : LIST_LIMIT,
    });
    return reviews.map(presentReview);
  }

  async create(userId: number, dto: CreateReviewDto): Promise<PresentedReview> {
    const itinerary = await this.itineraries.findOne({ where: { id: dto.itinerary }, relations: { review_stats: true } });
    const isOwner = itinerary ? await this.itineraries.exists({ where: { id: dto.itinerary, user: { id: userId } } }) : false;
    if (!itinerary || !canViewItinerary(itinerary, isOwner)) throw new NotFoundException('Roteiro nao encontrado.');
    if (!canReviewItinerary(itinerary, isOwner)) throw new BadRequestException('So e possivel avaliar roteiros prontos.');
    if (await this.reviews.exists({ where: { itinerary: { id: dto.itinerary }, user: { id: userId } } })) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }

    let saved: Review;
    try {
      saved = await this.reviews.save(
        this.reviews.create({
          itinerary: { id: dto.itinerary } as never,
          user: { id: userId } as never,
          rating: dto.rating,
          title: dto.title?.trim() ?? '',
          body: dto.body?.trim() ?? '',
        }),
      );
    } catch (error) {
      // Corrida entre duas requisicoes: a constraint unique do Django decide.
      if (isUniqueViolation(error)) throw new ConflictException(DUPLICATE_MESSAGE);
      throw error;
    }

    await this.refreshStats(dto.itinerary);
    await this.audit.log({
      event_type: 'review.created',
      actor_id: userId,
      content_type: 'Review',
      object_id: String(saved.id),
      metadata: { itinerary_id: dto.itinerary, rating: dto.rating },
    });
    return this.findPresented(saved.id);
  }

  async update(userId: number, id: number, dto: UpdateReviewDto): Promise<PresentedReview> {
    const review = await this.findOwned(userId, id);
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title.trim();
    if (dto.body !== undefined) review.body = dto.body.trim();
    await this.reviews.save(review);

    const itineraryId = Number(review.itinerary.id);
    await this.refreshStats(itineraryId);
    await this.audit.log({
      event_type: 'review.updated',
      actor_id: userId,
      content_type: 'Review',
      object_id: String(review.id),
      metadata: { itinerary_id: itineraryId, rating: review.rating },
    });
    return this.findPresented(review.id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const review = await this.findOwned(userId, id);
    const itineraryId = Number(review.itinerary.id);
    await this.reviews.delete({ id: review.id });
    await this.refreshStats(itineraryId);
    await this.audit.log({
      event_type: 'review.deleted',
      actor_id: userId,
      content_type: 'Review',
      object_id: String(id),
      metadata: { itinerary_id: itineraryId, rating: review.rating },
    });
  }

  private async findOwned(userId: number, id: number): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id, user: { id: userId } }, relations: { itinerary: true } });
    if (!review) throw new NotFoundException('Avaliacao nao encontrada.');
    return review;
  }

  private async findPresented(id: number): Promise<PresentedReview> {
    const review = await this.reviews.findOneOrFail({ where: { id }, relations: { user: true, itinerary: true } });
    return presentReview(review);
  }

  /** Sem avaliacoes o contador zera e o roteiro sai do ranking (volta a ser privado). */
  private async refreshStats(itineraryId: number): Promise<void> {
    const totals = await this.reviews
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'count')
      .addSelect('AVG(review.rating)', 'average')
      .where('review.itinerary_id = :itineraryId', { itineraryId })
      .getRawOne<{ count: string | number; average: string | null }>();
    const existing = await this.stats.findOne({ where: { itinerary: { id: itineraryId } } });
    await this.stats.save(
      this.stats.create({
        ...(existing ?? {}),
        itinerary: { id: itineraryId } as never,
        review_count: Number(totals?.count ?? 0),
        average_rating: Number(totals?.average ?? 0).toFixed(2),
      }),
    );
  }
}
```

- [ ] **Step 3: Controller**

`backend-nest/src/modules/itineraries/reviews.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@Query('itinerary', new ParseIntPipe({ optional: true })) itinerary?: number) {
    const reviews = await this.reviews.list(itinerary);
    return this.response.withMessage('Lista carregada com sucesso.').build(reviews);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    const review = await this.reviews.create(user.id, dto);
    return this.response.withMessage('Avaliacao publicada com sucesso.').build(review);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReviewDto) {
    const review = await this.reviews.update(user.id, id, dto);
    return this.response.withMessage('Avaliacao atualizada com sucesso.').build(review);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.reviews.remove(user.id, id);
    return this.response.withMessage('Avaliacao removida com sucesso.').build(null);
  }
}
```

- [ ] **Step 4: Registrar o service**

Em `backend-nest/src/modules/itineraries/itineraries.module.ts`, importar o service:

```ts
import { ReviewsService } from './reviews.service';
```

e trocar `providers: [ItinerariesService, ApiResponseBuilder],` por:

```ts
  providers: [ItinerariesService, ReviewsService, ApiResponseBuilder],
```

- [ ] **Step 5: Tirar reviews do `ItinerariesService`**

Em `backend-nest/src/modules/itineraries/itineraries.service.ts`:
- remover os métodos `listReviews` e `createReview` inteiros;
- remover do construtor as linhas `@InjectRepository(Review) private readonly reviews: Repository<Review>,` e `@InjectRepository(ReviewStat) private readonly reviewStats: Repository<ReviewStat>,`;
- trocar o import das entities por `import { FavoriteItinerary, Itinerary, ItineraryDay, SharedItineraryLink } from './entities';`;
- remover `import { CreateReviewDto } from './dto/create-review.dto';`.

- [ ] **Step 6: Build, testes e lint**

Run: `cd backend-nest && npm run build && npx jest && npm run lint`
Expected: build sem erros; testes PASS; lint limpo (sem imports sobrando)

- [ ] **Step 7: Commit**

```bash
git add backend-nest/src/modules/itineraries
git commit -m "feat(backend-nest): CRUD de avaliacoes com visibilidade e estatisticas"
```

---

## Task 13: Smoke HTTP do contrato do front

**Files:**
- Create: `backend-nest/scripts/smoke-contract.mjs`
- Modify: `backend-nest/package.json` (script `smoke`)

- [ ] **Step 1: Escrever o smoke**

`backend-nest/scripts/smoke-contract.mjs`:

```js
#!/usr/bin/env node
// Smoke HTTP do contrato usado pelo front contra um backend-nest em execucao.
// Rode contra um banco DESCARTAVEL migrado pelo Django com o seed: cada execucao cria usuarios e roteiros.
// Uso: BASE_URL=http://localhost:8001 npm run smoke
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8001').replace(/\/+$/, '');
const RUN = Date.now();
const PASSWORD = 'senha-smoke-123';
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const SENSITIVE = /password|email|pbkdf2/;

let failures = 0;

function check(condition, label, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  const shown = detail === undefined ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`  FAIL ${label}${shown.slice(0, 500)}`);
}

async function call(method, route, { token, json, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (form) body = form;
  const response = await fetch(`${BASE_URL}${route}`, { method, headers, body });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, payload, text };
}

async function register(label) {
  const email = `smoke-${label}-${RUN}@viajero.dev`;
  const res = await call('POST', '/api/auth/register/', {
    json: { email, password: PASSWORD, display_name: `Smoke ${label}`, first_name: 'Smoke', last_name: label },
  });
  check(res.status === 201, `cadastro (${label}) -> 201`, res.payload);
  return { email, token: res.payload?.data?.access, user: res.payload?.data?.user };
}

function imageForm(bytes, type, filename) {
  const form = new FormData();
  form.append('avatar', new Blob([bytes], { type }), filename);
  return form;
}

async function main() {
  console.log(`Smoke do contrato front <-> backend-nest em ${BASE_URL}`);

  console.log('\n# Autenticacao');
  const owner = await register('dono');
  const token = owner.token;
  check(typeof owner.user?.id === 'number', 'id do usuario e number', owner.user);
  const duplicate = await call('POST', '/api/auth/register/', { json: { email: owner.email, password: PASSWORD } });
  check(duplicate.status === 400 && duplicate.payload?.message === 'Ja existe um usuario cadastrado com este email.', 'email duplicado -> 400 PT', duplicate.payload);
  const login = await call('POST', '/api/auth/login/', { json: { email: owner.email, password: PASSWORD } });
  check(login.status === 200 && typeof login.payload?.data?.access === 'string', 'login -> 200 com token', login.payload);
  const badLogin = await call('POST', '/api/auth/login/', { json: { email: owner.email, password: 'senha-errada' } });
  check(badLogin.status === 400 && badLogin.payload?.message === 'Email ou senha invalidos.', 'senha errada -> 400 PT', badLogin.payload);
  const expired = await call('GET', '/api/users/me/', { token: 'token-invalido' });
  check(expired.status === 401 && expired.payload?.message === 'Sessao expirada ou nao autenticada. Entre novamente.', 'token invalido -> 401 PT', expired.payload);
  const missing = await call('GET', '/api/rota-inexistente/');
  check(missing.status === 404 && missing.payload?.message === 'Recurso nao encontrado.', 'rota inexistente -> 404 PT', missing.payload);

  console.log('\n# Perfil (onboarding)');
  const dnaBefore = await call('GET', '/api/traveler-dna/me/', { token });
  check(dnaBefore.status === 200 && dnaBefore.payload?.data === null, 'DNA inicial vazio', dnaBefore.payload);
  const dna = await call('PATCH', '/api/traveler-dna/me/', {
    token,
    json: { travel_style: 'balanced', pace: 'moderate', comfort_level: 'mid', social_energy: 5, adventure_level: 6, food_focus: 7, cultural_interest: 9, nature_interest: 4, nightlife_interest: 3, notes: '{"text":"smoke"}' },
  });
  check(dna.status === 200 && typeof dna.payload?.data?.id === 'number', 'PATCH DNA cria o perfil', dna.payload);
  const hijack = await call('PATCH', '/api/traveler-dna/me/', { token, json: { id: 999999, pace: 'fast' } });
  check(hijack.status === 200 && hijack.payload?.data?.id === dna.payload?.data?.id && hijack.payload?.data?.pace === 'fast', 'PATCH DNA ignora id enviado', hijack.payload);
  const prefs = await call('PATCH', '/api/trip-preferences/me/', {
    token,
    json: { budget_min: 2000, budget_max: 6000, currency_code: 'BRL', companionship: 'couple', preferred_trip_length_days: 4, travel_month: 'novembro', hotel_level: 'standard', transportation_style: 'public', dietary_preferences: [], accessibility_needs: [], interests: ['culture', 'food'], metadata: { flexible_dates: true } },
  });
  check(prefs.status === 200 && typeof prefs.payload?.data?.id === 'number', 'PATCH preferencias', prefs.payload);
  const me = await call('GET', '/api/users/me/', { token });
  check(me.payload?.data?.is_profile_complete === true, 'is_profile_complete vira true', me.payload);
  const patchMe = await call('PATCH', '/api/users/me/', { token, json: { display_name: 'Smoke Dono Editado' } });
  check(patchMe.status === 200 && patchMe.payload?.data?.display_name === 'Smoke Dono Editado', 'PATCH usuario', patchMe.payload);

  console.log('\n# Avatar');
  const avatar = await call('POST', '/api/users/me/avatar/', { token, form: imageForm(PNG_1X1, 'image/png', 'avatar.png') });
  const avatarUrl = avatar.payload?.data?.avatar_url;
  check(avatar.status === 200 && typeof avatarUrl === 'string' && avatarUrl.includes('/uploads/avatars/'), 'upload de avatar', avatar.payload);
  if (typeof avatarUrl === 'string') {
    const image = await fetch(avatarUrl);
    check(
      image.status === 200 && image.headers.get('content-type')?.startsWith('image/png') && image.headers.get('x-content-type-options') === 'nosniff',
      'avatar servido em /uploads com nosniff',
      `${image.status} ${image.headers.get('content-type')}`,
    );
  }
  const badAvatar = await call('POST', '/api/users/me/avatar/', { token, form: imageForm(Buffer.from('nao sou imagem'), 'text/plain', 'nota.txt') });
  check(badAvatar.status === 400 && badAvatar.payload?.message === 'Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.', 'avatar com tipo invalido -> 400 PT', badAvatar.payload);

  console.log('\n# Destinos');
  const destinations = await call('GET', '/api/destinations/');
  const list = destinations.payload?.data ?? [];
  check(destinations.status === 200 && list.length > 0 && typeof list[0].id === 'number', 'lista de destinos com ids numericos', destinations.payload?.message);
  const target = list.find((item) => (item.pois ?? []).length > 0) ?? list[0];
  const search = await call('GET', `/api/destinations/search/?q=${encodeURIComponent(target.name)}`);
  check(search.status === 200 && (search.payload?.data ?? []).some((item) => item.id === target.id), 'busca encontra o destino', search.payload?.message);
  const suggest = await call('POST', '/api/destinations/suggest/', { token });
  check(suggest.status === 200 && typeof suggest.payload?.data?.id === 'number' && suggest.payload?.message?.startsWith('Destino sugerido'), 'sugestao de destino', suggest.payload?.message);

  console.log('\n# Roteiro (fluxo do front)');
  const created = await call('POST', '/api/itineraries/', { token, json: { destination: target.id, title: target.name } });
  const itinerary = created.payload?.data;
  const itineraryId = itinerary?.id;
  check(created.status === 201 && itinerary?.duration_days === 4 && itinerary?.budget_total === '4000.00', 'criacao com payload do front usa preferencias', created.payload);
  const dates = await call('PATCH', `/api/itineraries/${itineraryId}/`, { token, json: { start_date: '2026-11-10', end_date: '2026-11-13' } });
  check(dates.status === 200 && dates.payload?.data?.start_date === '2026-11-10' && dates.payload?.data?.end_date === '2026-11-13', 'PATCH de datas', dates.payload?.data);
  const badDates = await call('PATCH', `/api/itineraries/${itineraryId}/`, { token, json: { end_date: '2026-11-01' } });
  check(badDates.status === 400 && badDates.payload?.message === 'A data final nao pode ser anterior a data inicial.', 'data final anterior -> 400 PT', badDates.payload);
  const generated = await call('POST', `/api/itineraries/${itineraryId}/generate/`, { token });
  check(generated.status === 202 && generated.payload?.data?.generation_status === 'ready' && (generated.payload?.data?.days ?? []).length === 4, 'geracao -> 202 pronto com 4 dias', generated.payload?.message);
  const regenerated = await call('POST', `/api/itineraries/${itineraryId}/generate/`, { token });
  check(regenerated.status === 202 && (regenerated.payload?.data?.days ?? []).length === 4, 'regeracao funciona', regenerated.payload?.message);
  const detail = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(detail.status === 200 && detail.payload?.data?.is_owner === true, 'detalhe do dono com is_owner', detail.payload?.message);
  const mine = await call('GET', '/api/itineraries/', { token });
  check((mine.payload?.data ?? []).some((item) => item.id === itineraryId), 'roteiro na lista do dono');

  console.log('\n# Avaliacoes');
  const visitor = await register('visitante');
  const privateDetail = await call('GET', `/api/itineraries/${itineraryId}/`, { token: visitor.token });
  check(privateDetail.status === 404, 'visitante nao ve roteiro privado', privateDetail.payload);
  const rankingBefore = await call('GET', '/api/itineraries/top-rated/');
  check(!(rankingBefore.payload?.data ?? []).some((item) => item.id === itineraryId), 'roteiro privado fora do top-rated');
  const earlyReview = await call('POST', '/api/reviews/', { token: visitor.token, json: { itinerary: itineraryId, rating: 4 } });
  check(earlyReview.status === 404, 'visitante nao avalia roteiro privado', earlyReview.payload);
  const ownerReview = await call('POST', '/api/reviews/', { token, json: { itinerary: itineraryId, rating: 5, title: 'Perfeito', body: 'Roteiro equilibrado.' } });
  check(ownerReview.status === 201 && ownerReview.payload?.data?.user?.display_name === 'Smoke Dono Editado', 'dono avalia o proprio roteiro', ownerReview.payload);
  check(!SENSITIVE.test(ownerReview.text), 'resposta da avaliacao sem dados sensiveis', ownerReview.text);
  const again = await call('POST', '/api/reviews/', { token, json: { itinerary: itineraryId, rating: 4 } });
  check(again.status === 409 && again.payload?.message === 'Voce ja avaliou este roteiro.', 'avaliacao duplicada -> 409 PT', again.payload);
  const ranking = await call('GET', '/api/itineraries/top-rated/');
  const ranked = (ranking.payload?.data ?? []).find((item) => item.id === itineraryId);
  check(ranked?.review_stats?.review_count === 1, 'roteiro avaliado entra no top-rated', ranking.payload?.message);
  const publicDetail = await call('GET', `/api/itineraries/${itineraryId}/`, { token: visitor.token });
  check(publicDetail.status === 200 && publicDetail.payload?.data?.is_owner === false, 'visitante ve roteiro publico', publicDetail.payload?.message);
  const visitorReview = await call('POST', '/api/reviews/', { token: visitor.token, json: { itinerary: itineraryId, rating: 3 } });
  check(visitorReview.status === 201, 'visitante avalia roteiro publico', visitorReview.payload);
  const afterTwo = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(afterTwo.payload?.data?.review_stats?.review_count === 2 && afterTwo.payload?.data?.review_stats?.average_rating === '4.00', 'media com 2 avaliacoes (4.00)', afterTwo.payload?.data?.review_stats);
  const visitorReviewId = visitorReview.payload?.data?.id;
  const edited = await call('PATCH', `/api/reviews/${visitorReviewId}/`, { token: visitor.token, json: { rating: 4, body: 'Mudei de ideia.' } });
  check(edited.status === 200 && edited.payload?.data?.rating === 4, 'visitante edita a propria avaliacao', edited.payload);
  const afterEdit = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(afterEdit.payload?.data?.review_stats?.average_rating === '4.50', 'media apos edicao (4.50)', afterEdit.payload?.data?.review_stats);
  const foreignEdit = await call('PATCH', `/api/reviews/${ownerReview.payload?.data?.id}/`, { token: visitor.token, json: { rating: 1 } });
  check(foreignEdit.status === 404, 'visitante nao edita avaliacao do dono', foreignEdit.payload);
  const removed = await call('DELETE', `/api/reviews/${visitorReviewId}/`, { token: visitor.token });
  check(removed.status === 200, 'visitante exclui a propria avaliacao', removed.payload);
  const publicList = await call('GET', `/api/reviews/?itinerary=${itineraryId}`);
  check(publicList.status === 200 && (publicList.payload?.data ?? []).length === 1, 'lista publica com 1 avaliacao', publicList.payload);
  check(!SENSITIVE.test(publicList.text), 'lista publica sem dados sensiveis', publicList.text);
  const afterDelete = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(afterDelete.payload?.data?.review_stats?.review_count === 1 && afterDelete.payload?.data?.review_stats?.average_rating === '5.00', 'stats apos exclusao (1, 5.00)', afterDelete.payload?.data?.review_stats);

  console.log(failures === 0 ? '\nSmoke OK' : `\nSmoke falhou: ${failures} verificacao(oes)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Script npm**

Em `backend-nest/package.json`, adicionar após `"lint"`:

```json
    "smoke": "node scripts/smoke-contract.mjs",
```

- [ ] **Step 3: Subir o ambiente de teste**

Seguir **Ambiente de teste** (topo do plano): recriar `viajero-nest-it`, migrar + seed pelo Django, `npm run build` e subir `node dist/main.js` em background apontando para `localhost:55432/viajero_it`.

- [ ] **Step 4: Rodar o smoke**

Run: `cd backend-nest && npm run smoke`
Expected: todas as linhas `ok` e `Smoke OK` (exit 0). Qualquer `FAIL`: depurar com `superpowers:systematic-debugging` antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add backend-nest/scripts/smoke-contract.mjs backend-nest/package.json
git commit -m "test(backend-nest): smoke HTTP do contrato usado pelo front"
```

---

## Task 14: Front — mensagens do backend e sessão expirada

**Files:**
- Modify: `front/src/lib/api.ts`
- Modify: `front/src/lib/auth.ts`
- Modify: `front/src/contexts/authContext.tsx`
- Modify: `front/src/pages/login/login.tsx`

- [ ] **Step 1: Cliente HTTP**

`front/src/lib/api.ts`:

```ts
const DEFAULT_API_BASE_URL = "http://localhost:8001";
const ACCESS_TOKEN_KEY = "viajero.access_token";

/** Disparado quando uma requisição autenticada recebe 401 (token expirado ou inválido). */
export const SESSION_EXPIRED_EVENT = "viajero:session-expired";
const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente para continuar.";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  errors?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.errors = (payload as { errors?: unknown; })?.errors;
  }
}

export interface ApiSuccessResponse<T> extends Record<string, unknown> {
  data?: T;
  results?: unknown;
  items?: unknown;
  message?: string;
  detail?: string;
  success?: boolean;
  errors?: unknown;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return trimTrailingSlash(configured?.trim() || DEFAULT_API_BASE_URL);
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${getApiBaseUrl()}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/** O backend manda a mensagem para a UI em `message`; `detail` fica como alternativa. */
function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const { message, detail } = payload as { message?: unknown; detail?: unknown; };
  return [message, detail].find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const headers = new Headers(init.headers || {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), { ...init, headers });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.", 0, error);
  }

  if (!response.ok) {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      // Keep fallback message when the server does not return JSON.
    }

    let message = readErrorMessage(payload) ?? `Não foi possível concluir a solicitação (erro ${response.status}). Tente novamente.`;

    if (response.status === 401 && headers.has("Authorization")) {
      message = SESSION_EXPIRED_MESSAGE;
      if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  return apiFetch<T>(path, init, params);
}

export function unwrapListResponse<T>(
  payload:
    | T[]
    | { results?: T[]; data?: T[] | { results?: T[]; items?: T[]; }; items?: T[]; }
    | null
    | undefined,
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload) {
    return [];
  }

  if ("results" in payload && Array.isArray(payload.results)) {
    return payload.results;
  }

  if ("data" in payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  if ("data" in payload && payload.data && typeof payload.data === "object") {
    if ("results" in payload.data && Array.isArray(payload.data.results)) {
      return payload.data.results;
    }

    if ("items" in payload.data && Array.isArray(payload.data.items)) {
      return payload.data.items;
    }
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}
```

- [ ] **Step 2: Persistir só o usuário**

Em `front/src/lib/auth.ts`, trocar a função `persistAuth` por:

```ts
export function persistUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function persistAuth(payload: AuthPayload) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refresh);
  persistUser(payload.user);
}
```

- [ ] **Step 3: Contexto escuta a expiração e expõe `updateUser`**

`front/src/contexts/authContext.tsx`:

```tsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { SESSION_EXPIRED_EVENT } from '@/lib/api'
import { getStoredUser, persistAuth, persistUser, type AuthPayload, type AuthUser } from '@/lib/auth'

interface AuthContextValue {
  token: string
  user: AuthUser | null
  isAuthenticated: boolean
  isGuest: boolean
  /** true quando a sessão terminou por 401; o login mostra o aviso. */
  sessionExpired: boolean
  setAuth: (payload: AuthPayload) => void
  updateUser: (user: AuthUser) => void
  logout: () => void
  refreshUser: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('viajero.access_token') ?? ''
  })

  const [user, setUser] = useState<AuthUser | null>(() => {
    return getStoredUser()
  })

  const [sessionExpired, setSessionExpired] = useState(false)

  const isAuthenticated = !!token
  const isGuest = !token

  const logout = useCallback(() => {
    localStorage.removeItem('viajero.access_token')
    localStorage.removeItem('viajero.refresh_token')
    setToken('')
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    function handleSessionExpired() {
      logout()
      setSessionExpired(true)
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [logout])

  function setAuth(payload: AuthPayload) {
    persistAuth(payload)
    setToken(payload.access)
    setUser(payload.user)
    setSessionExpired(false)
  }

  function updateUser(nextUser: AuthUser) {
    persistUser(nextUser)
    setUser(nextUser)
  }

  function refreshUser() {
    setUser(getStoredUser())
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, isGuest, sessionExpired, setAuth, updateUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
```

- [ ] **Step 4: Login usa `message` e mostra o aviso**

Em `front/src/pages/login/login.tsx`:

1. Remover a função `getFieldError` inteira (linhas 22–28).
2. Trocar `const { setAuth } = useAuth();` por `const { setAuth, sessionExpired } = useAuth();`.
3. No `catch`, trocar `setSubmitError(getFieldError(error.errors) ?? error.message);` por `setSubmitError(error.message);`.
4. Logo antes de `<form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>`, inserir:

```tsx
        {sessionExpired && !submitError && (
          <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sua sessão expirou. Entre novamente para continuar.
          </div>
        )}
```

- [ ] **Step 5: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: build e lint sem erros

- [ ] **Step 6: Commit**

```bash
git add front/src/lib/api.ts front/src/lib/auth.ts front/src/contexts/authContext.tsx front/src/pages/login/login.tsx
git commit -m "feat(front): mensagens do backend e logout automatico em sessao expirada"
```

---

## Task 15: Front — perfil sincroniza a Sidebar

**Files:**
- Modify: `front/src/pages/user-profile/user.tsx`

- [ ] **Step 1: Usar `updateUser` após salvar**

Em `front/src/pages/user-profile/user.tsx`:

1. Abaixo de `import { useAuth } from "@/contexts/authContext";`, adicionar:

```ts
import type { AuthUser } from "@/lib/auth";
```

2. Trocar `const { isGuest, refreshUser } = useAuth();` por:

```ts
  const { isGuest, refreshUser, updateUser } = useAuth();
```

3. Em `handleSave`, trocar o bloco `await apiRequest("/api/users/me/", { ... });` por:

```ts
      const response = await apiRequest<{ data?: AuthUser; }>("/api/users/me/", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (response.data) updateUser(response.data);
```

4. Trocar o corpo de `handleAvatarChange` a partir de `setAvatarUploading(true);` até o fim da função por:

```ts
    setAvatarUploading(true);
    setSaveError(null);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const response = await apiRequest<{ data?: AuthUser; }>("/api/users/me/avatar/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (response.data) updateUser(response.data);
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível enviar o avatar. Tente novamente.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }
```

5. No `<input ref={fileRef} type="file" ...>`, trocar `accept="image/*"` por `accept="image/png,image/jpeg,image/webp,image/gif"`.

- [ ] **Step 2: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add front/src/pages/user-profile/user.tsx
git commit -m "fix(front): perfil e avatar atualizam o usuario da sessao"
```

---

## Task 16: Front — remover o mock

**Files:**
- Delete: `front/src/mock-backend.ts`
- Modify: `front/src/main.tsx`
- Modify: `front/README.md`

- [ ] **Step 1: Apagar o mock e o bootstrap**

Run: `git rm front/src/mock-backend.ts`

`front/src/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client'
import "@fontsource-variable/geist"
import "./index.css"
import App from './App.tsx'

import { AuthProvider } from '@/contexts/authContext'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
```

- [ ] **Step 2: README**

`front/README.md`:

````md
# Viajero frontend

React 19, TypeScript 6, Vite 8 e Tailwind CSS v4. Radix, CVA e Lucide compõem a base de interface existente.

## Executar

O front consome o backend NestJS (`../backend-nest`). Suba o backend antes, seguindo `../backend-nest/README.md` (banco migrado pelo Django + `npm run start:dev`).

```powershell
npm ci
npm run dev
```

Vite abre em http://localhost:5173. Configure a API em um arquivo `.env.local`, usando `.env.example` como referência:

```dotenv
VITE_API_URL=http://localhost:8001
```

O padrão é o NestJS em `http://localhost:8001`. Reinicie o Vite após alterar a variável. O frontend não inicia nem modifica o backend.

## Sessão

O token JWT expira conforme `JWT_ACCESS_MINUTES` do backend (60 minutos por padrão). Quando uma requisição autenticada recebe 401, o front encerra a sessão e volta para o login com o aviso de sessão expirada.

## Avaliações

O detalhe do roteiro (`/roteiros/:id`) tem a seção "Avaliações": nota de 1 a 5, título e comentário, com edição e exclusão da própria avaliação. A Home lista os "Roteiros mais bem avaliados". Ao avaliar o próprio roteiro, ele passa a aparecer anonimamente no ranking e pode ser aberto e avaliado por outros usuários.

## Verificar

```powershell
npm run build
npm run lint
```

O teste de navegador `scripts/browser-check.mjs` usa uma instalação existente de Playwright indicada por `PLAYWRIGHT_MODULE` e Edge por padrão. Ele gera fixtures isoladas e screenshots em `artifacts/`; não valida um servidor real.
````

- [ ] **Step 3: Conferir que nada mais referencia o mock**

Run: `cd front && grep -rn "mock-backend\|VITE_MOCK_API" src README.md .env.example`
Expected: nenhuma saída

- [ ] **Step 4: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add -A front/src/main.tsx front/src/mock-backend.ts front/README.md
git commit -m "chore(front): remove mock temporario e documenta uso com backend-nest"
```

---

## Task 17: Front — tipos, API e hook de avaliações

**Files:**
- Modify: `front/src/types/travel.ts`
- Modify: `front/src/lib/utils.ts`
- Modify: `front/src/lib/itineraries.ts`
- Modify: `front/src/hooks/useItineraries.ts`
- Create: `front/src/lib/reviews.ts`
- Create: `front/src/hooks/useReviews.ts`

- [ ] **Step 1: Tipos**

Em `front/src/types/travel.ts`, antes de `export interface Itinerary`, adicionar:

```ts
export interface ReviewStats {
  id?: number | string;
  review_count: number;
  average_rating: number | string;
}

export interface ReviewAuthor {
  id: number;
  display_name: string;
  avatar_url?: string | null;
}

export interface Review {
  id: number;
  itinerary: number;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  user: ReviewAuthor;
}
```

e, dentro de `Itinerary`, trocar `review_stats?: Record<string, unknown> | null;` por:

```ts
  review_stats?: ReviewStats | null;
  /** Presente no detalhe: o usuário logado é o dono do roteiro. */
  is_owner?: boolean;
```

- [ ] **Step 2: Formatação de nota**

Em `front/src/lib/utils.ts`, adicionar ao fim:

```ts
export function formatRating(value: string | number | null | undefined) {
  const numeric = Number(value);
  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
```

- [ ] **Step 3: Ranking**

`front/src/lib/itineraries.ts`:

```ts
import { apiFetch, unwrapListResponse } from "./api";
import type { Itinerary } from "../types/travel";
import type { Destination } from "../types/travel";

type ItinerariesPayload = Itinerary[] | { results?: Itinerary[]; data?: Itinerary[]; items?: Itinerary[]; };

export type ItineraryWithDestination = Itinerary & {
  [key: string]: unknown;
  destination?: Destination | string | null;
  destinationData?: Destination | null;
};

export async function fetchItineraries() {
  const payload = await apiFetch<ItinerariesPayload>("/api/itineraries/");
  return unwrapListResponse(payload);
}

export async function fetchTopRatedItineraries() {
  const payload = await apiFetch<ItinerariesPayload>("/api/itineraries/top-rated/");
  return unwrapListResponse(payload);
}

export async function fetchFeaturedItineraries() {
  const topRated = await fetchTopRatedItineraries();

  if (topRated.length > 0) {
    return topRated;
  }

  const templatesPayload = await apiFetch<ItinerariesPayload>("/api/itineraries/templates/");
  return unwrapListResponse(templatesPayload);
}
```

Em `front/src/hooks/useItineraries.ts`:
1. Trocar o import por `import { fetchFeaturedItineraries, fetchItineraries, fetchTopRatedItineraries } from "../lib/itineraries";`.
2. Trocar `type ItineraryMode = "mine" | "featured";` por `type ItineraryMode = "mine" | "featured" | "top-rated";`.
3. Trocar o bloco `const data = mode === "featured" ? await fetchFeaturedItineraries() : await fetchItineraries();` por:

```ts
        const data =
          mode === "featured"
            ? await fetchFeaturedItineraries()
            : mode === "top-rated"
              ? await fetchTopRatedItineraries()
              : await fetchItineraries();
```

- [ ] **Step 4: API de avaliações**

`front/src/lib/reviews.ts`:

```ts
import { apiRequest, unwrapListResponse } from "./api";
import type { Review } from "@/types/travel";

export interface ReviewInput {
  rating: number;
  title: string;
  body: string;
}

export async function listReviews(itineraryId: number | string, signal?: AbortSignal) {
  const payload = await apiRequest<{ data?: Review[]; }>("/api/reviews/", { signal }, { itinerary: itineraryId });
  return unwrapListResponse<Review>(payload);
}

export async function createReview(itineraryId: number | string, input: ReviewInput) {
  const payload = await apiRequest<{ data: Review; }>("/api/reviews/", {
    method: "POST",
    body: JSON.stringify({ itinerary: Number(itineraryId), ...input }),
  });
  return payload.data;
}

export async function updateReview(reviewId: number, input: ReviewInput) {
  const payload = await apiRequest<{ data: Review; }>(`/api/reviews/${reviewId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function deleteReview(reviewId: number) {
  await apiRequest(`/api/reviews/${reviewId}/`, { method: "DELETE" });
}
```

- [ ] **Step 5: Hook**

`front/src/hooks/useReviews.ts`:

```ts
import { useCallback, useState } from "react";
import { createReview, deleteReview, listReviews, updateReview, type ReviewInput } from "@/lib/reviews";
import type { Review } from "@/types/travel";
import { useAsyncResource } from "./useAsyncResource";

export function useReviews(itineraryId: number | string) {
  const load = useCallback((signal: AbortSignal) => listReviews(itineraryId, signal), [itineraryId]);
  const { data: reviews, loading, error, refetch } = useAsyncResource<Review[]>(load, []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function run(operation: () => Promise<unknown>) {
    setSaving(true);
    setSaveError(null);
    try {
      await operation();
      refetch();
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar a avaliação.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    reviews,
    loading,
    error,
    refetch,
    saving,
    saveError,
    clearSaveError: () => setSaveError(null),
    create: (input: ReviewInput) => run(() => createReview(itineraryId, input)),
    update: (reviewId: number, input: ReviewInput) => run(() => updateReview(reviewId, input)),
    remove: (reviewId: number) => run(() => deleteReview(reviewId)),
  };
}
```

- [ ] **Step 6: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 7: Commit**

```bash
git add front/src/types/travel.ts front/src/lib/utils.ts front/src/lib/itineraries.ts front/src/hooks/useItineraries.ts front/src/lib/reviews.ts front/src/hooks/useReviews.ts
git commit -m "feat(front): tipos, API e hook de avaliacoes"
```

---

## Task 18: Front — estrelas (leitura e entrada acessível)

**Files:**
- Create: `front/src/components/ui/star-rating.tsx`

- [ ] **Step 1: Componentes**

`front/src/components/ui/star-rating.tsx`:

```tsx
import { Star } from "lucide-react";
import { useId } from "react";
import { cn, formatRating } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;
const STAR_LABELS = ["Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

export function StarRating({ value, size = "sm", className }: { value: number; size?: "sm" | "md"; className?: string; }) {
  const filled = Math.round(value);
  return <span role="img" aria-label={`Nota ${formatRating(value)} de 5`} className={cn("inline-flex items-center gap-0.5", className)}>
    {STARS.map(star => <Star key={star} aria-hidden="true" className={cn(size === "md" ? "size-5" : "size-4", star <= filled ? "fill-amber-500 text-amber-500" : "fill-transparent text-input")} />)}
  </span>;
}

/** Radios nativos (setas do teclado funcionam) com estrelas como rótulo. */
export function StarRatingInput({ name, legend, value, onChange, error, disabled = false }: {
  name: string;
  legend: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}) {
  const errorId = useId();
  return <fieldset className="space-y-2" disabled={disabled} aria-describedby={error ? errorId : undefined}>
    <legend className="text-sm font-medium text-strong">{legend}</legend>
    <div className="flex flex-wrap items-center gap-1">
      {STARS.map(star => {
        const id = `${name}-${star}`;
        return <label key={star} htmlFor={id} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-control transition-colors hover:bg-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <input id={id} type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} className="sr-only" aria-label={`${star} de 5: ${STAR_LABELS[star - 1]}`} />
          <Star aria-hidden="true" className={cn("size-7 transition-colors", star <= value ? "fill-amber-500 text-amber-500" : "fill-transparent text-input")} />
        </label>;
      })}
      <span className="ml-2 text-sm text-muted-foreground">{value ? STAR_LABELS[value - 1] : "Selecione uma nota"}</span>
    </div>
    {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}
```

- [ ] **Step 2: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add front/src/components/ui/star-rating.tsx
git commit -m "feat(front): componentes de estrelas para avaliacao"
```

---

## Task 19: Front — formulário, lista e seção de avaliações

**Files:**
- Create: `front/src/features/reviews/review-form.tsx`
- Create: `front/src/features/reviews/review-list.tsx`
- Create: `front/src/features/reviews/reviews-section.tsx`

- [ ] **Step 1: Formulário**

`front/src/features/reviews/review-form.tsx`:

```tsx
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StarRatingInput } from "@/components/ui/star-rating";
import type { ReviewInput } from "@/lib/reviews";

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Escolha uma nota de 1 a 5.").max(5, "Escolha uma nota de 1 a 5."),
  title: z.string().trim().max(120, "Use no máximo 120 caracteres."),
  body: z.string().trim().max(2000, "Use no máximo 2000 caracteres."),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

export function ReviewForm({ initial, isOwner, saving, serverError, onSubmit, onCancel }: {
  initial?: ReviewInput;
  isOwner: boolean;
  saving: boolean;
  serverError: string | null;
  onSubmit: (values: ReviewInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: initial ?? { rating: 0, title: "", body: "" },
  });
  const editing = Boolean(initial);

  return <form className="space-y-5" noValidate onSubmit={handleSubmit(values => onSubmit(values))}>
    <Controller name="rating" control={control} render={({ field }) => <StarRatingInput
      name="review-rating"
      legend={isOwner ? "Como foi sua viagem?" : "Avalie este roteiro"}
      value={field.value}
      onChange={field.onChange}
      error={errors.rating?.message}
      disabled={saving}
    />} />
    <div className="space-y-2">
      <label htmlFor="review-title" className="text-sm font-medium text-strong">Título <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <Input id="review-title" maxLength={120} placeholder="Resuma sua experiência" aria-invalid={!!errors.title} aria-describedby={errors.title ? "review-title-error" : undefined} disabled={saving} {...register("title")} />
      {errors.title && <p id="review-title-error" role="alert" className="text-sm text-destructive">{errors.title.message}</p>}
    </div>
    <div className="space-y-2">
      <label htmlFor="review-body" className="text-sm font-medium text-strong">Comentário <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <textarea
        id="review-body"
        rows={4}
        maxLength={2000}
        placeholder="O que funcionou bem? O que você mudaria?"
        className="min-h-28 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        aria-invalid={!!errors.body}
        aria-describedby={errors.body ? "review-body-error" : undefined}
        disabled={saving}
        {...register("body")}
      />
      {errors.body && <p id="review-body-error" role="alert" className="text-sm text-destructive">{errors.body.message}</p>}
    </div>
    {isOwner && !editing && <p className="text-xs leading-5 text-muted-foreground">Ao avaliar, este roteiro passa a aparecer anonimamente no ranking de mais bem avaliados.</p>}
    {serverError && <p role="alert" className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">{serverError}</p>}
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Publicar avaliação"}</Button>
      {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>}
    </div>
  </form>;
}
```

- [ ] **Step 2: Lista**

`front/src/features/reviews/review-list.tsx`:

```tsx
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import type { Review } from "@/types/travel";

function formatReviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function wasEdited(review: Review) {
  return new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 1000;
}

export function ReviewItem({ review, mine = false, onEdit, onDelete }: {
  review: Review;
  mine?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const name = review.user.display_name || "Viajante";
  return <article className="space-y-3 py-5" aria-label={`Avaliação de ${mine ? "você" : name}`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-primary">
          {review.user.avatar_url ? <img src={review.user.avatar_url} alt="" className="size-full object-cover" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{mine ? `${name} (você)` : name}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>{wasEdited(review) && " · editada"}
          </p>
        </div>
      </div>
      <StarRating value={review.rating} />
    </header>
    {review.title && <h4 className="text-base">{review.title}</h4>}
    {review.body && <p className="max-w-[65ch] whitespace-pre-line text-sm leading-6 text-strong">{review.body}</p>}
    {mine && (onEdit || onDelete) && <div className="flex flex-wrap gap-2">
      {onEdit && <Button variant="outline" onClick={onEdit}><Pencil aria-hidden="true" />Editar</Button>}
      {onDelete && <Button variant="destructive" onClick={onDelete}><Trash2 aria-hidden="true" />Excluir</Button>}
    </div>}
  </article>;
}

export function ReviewList({ reviews }: { reviews: Review[]; }) {
  return <ul className="divide-y divide-border">
    {reviews.map(review => <li key={review.id}><ReviewItem review={review} /></li>)}
  </ul>;
}
```

- [ ] **Step 3: Seção**

`front/src/features/reviews/reviews-section.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Feedback } from "@/components/ui/feedback";
import { StarRating } from "@/components/ui/star-rating";
import { useAuth } from "@/contexts/authContext";
import { useReviews } from "@/hooks/useReviews";
import type { ReviewInput } from "@/lib/reviews";
import { formatRating } from "@/lib/utils";
import type { Itinerary } from "@/types/travel";
import { ReviewForm } from "./review-form";
import { ReviewItem, ReviewList } from "./review-list";

/** `onChanged` recarrega o roteiro para refletir média e total atualizados. */
export function ReviewsSection({ itinerary, onChanged }: { itinerary: Itinerary; onChanged: () => void; }) {
  const { user } = useAuth();
  const { reviews, loading, error, refetch, saving, saveError, clearSaveError, create, update, remove } = useReviews(itinerary.id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = user ? reviews.find(review => review.user.id === user.id) : undefined;
  const others = reviews.filter(review => review !== mine);
  const count = Number(itinerary.review_stats?.review_count ?? 0);
  const average = Number(itinerary.review_stats?.average_rating ?? 0);
  const canReview = itinerary.generation_status === "ready";

  async function handleCreate(input: ReviewInput) {
    const ok = await create(input);
    if (ok) onChanged();
    return ok;
  }

  async function handleUpdate(input: ReviewInput) {
    if (!mine) return false;
    const ok = await update(mine.id, input);
    if (ok) {
      setEditing(false);
      onChanged();
    }
    return ok;
  }

  async function handleDelete() {
    if (!mine) return;
    const ok = await remove(mine.id);
    setConfirmDelete(false);
    if (ok) onChanged();
  }

  return <section id="avaliacoes" aria-labelledby="avaliacoes-title" className="scroll-mt-24 space-y-6">
    <div className="space-y-2 border-b border-border pb-4">
      <h2 id="avaliacoes-title" className="section-title">Avaliações</h2>
      {count > 0 ? <p className="flex flex-wrap items-center gap-2 text-sm text-strong">
        <StarRating value={average} size="md" />
        <span className="font-medium">{formatRating(average)}</span>
        <span className="text-muted-foreground">({count} {count === 1 ? "avaliação" : "avaliações"})</span>
      </p> : <p className="text-sm text-muted-foreground">Este roteiro ainda não tem avaliações.</p>}
    </div>

    {loading ? <Feedback kind="loading" title="Carregando avaliações…" /> : error ? <Feedback kind="error" title="Não conseguimos carregar as avaliações" description={error} onRetry={refetch} /> : <>
      {canReview ? <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <h3 className="mb-4 text-lg">{mine ? "Sua avaliação" : count === 0 ? "Seja o primeiro a avaliar" : "Deixe sua avaliação"}</h3>
        {mine && !editing
          ? <ReviewItem review={mine} mine onEdit={() => { clearSaveError(); setEditing(true); }} onDelete={() => { clearSaveError(); setConfirmDelete(true); }} />
          : <ReviewForm
            key={mine ? `edit-${mine.id}` : "new"}
            isOwner={Boolean(itinerary.is_owner)}
            saving={saving}
            serverError={saveError}
            initial={mine ? { rating: mine.rating, title: mine.title, body: mine.body } : undefined}
            onSubmit={mine ? handleUpdate : handleCreate}
            onCancel={mine ? () => setEditing(false) : undefined}
          />}
        {mine && !editing && saveError && <p role="alert" className="mt-3 text-sm text-destructive">{saveError}</p>}
      </div> : <p className="text-sm text-muted-foreground">A avaliação fica disponível quando o roteiro estiver pronto.</p>}

      {others.length > 0 && <div className="space-y-2">
        <h3 className="text-lg">{mine ? "Outras avaliações" : "O que os viajantes dizem"}</h3>
        <ReviewList reviews={others} />
      </div>}
    </>}

    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir sua avaliação?</DialogTitle>
          <DialogDescription>Essa ação não pode ser desfeita. A nota média do roteiro será recalculada.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? "Excluindo…" : "Excluir avaliação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
```

- [ ] **Step 4: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add front/src/features/reviews
git commit -m "feat(front): formulario, lista e secao de avaliacoes"
```

---

## Task 20: Front — avaliações no detalhe e nota nos cards

**Files:**
- Modify: `front/src/pages/roteiros/roteiro-detalhe.tsx`
- Modify: `front/src/pages/roteiros/itinerary-card.tsx`

- [ ] **Step 1: Detalhe do roteiro**

Em `front/src/pages/roteiros/roteiro-detalhe.tsx`:

1. Trocar `import { Loader2 } from "lucide-react";` por `import { Loader2, Star } from "lucide-react";`.
2. Abaixo de `import { useDestinations } from '@/hooks/useDestinations';`, adicionar:

```ts
import { ReviewsSection } from '@/features/reviews/reviews-section';
```

3. Trocar a linha do status no cabeçalho:

```tsx
      <span className="status-badge" data-status={itinerary.generation_status}>{itineraryStatus(itinerary.generation_status)}</span>
```

por:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <span className="status-badge" data-status={itinerary.generation_status}>{itineraryStatus(itinerary.generation_status)}</span>
        {itinerary.generation_status === 'ready' && <Button asChild variant="outline"><a href="#avaliacoes"><Star aria-hidden="true" />Avaliar roteiro</a></Button>}
      </div>
```

4. Trocar o rodapé:

```tsx
    <div><Button asChild variant="outline"><Link to="/roteiros">Voltar para seus roteiros</Link></Button></div>
```

por:

```tsx
    <ReviewsSection itinerary={itinerary} onChanged={() => setRevision(value => value + 1)} />
    <div><Button asChild variant="outline">{itinerary.is_owner === false ? <Link to="/">Voltar para a Home</Link> : <Link to="/roteiros">Voltar para seus roteiros</Link>}</Button></div>
```

- [ ] **Step 2: Badge de nota no card**

Em `front/src/pages/roteiros/itinerary-card.tsx`:

1. Trocar `import { CalendarDays, Clock3 } from 'lucide-react';` por `import { CalendarDays, Clock3, Star } from 'lucide-react';`.
2. Abaixo do import de `itinerary-presentation`, adicionar:

```ts
import { formatRating } from '@/lib/utils';
```

3. Depois de `const href = \`/roteiros/${itinerary.id}\`;`, adicionar:

```ts
  const reviewCount = Number(itinerary.review_stats?.review_count ?? 0);
  const averageRating = Number(itinerary.review_stats?.average_rating ?? 0);
```

4. Logo após o `<span className="status-badge pointer-events-none absolute left-4 top-4" ...>...</span>`, adicionar:

```tsx
      {reviewCount > 0 && <span className="badge pointer-events-none absolute right-4 top-4 bg-surface text-foreground shadow-control">
        <Star aria-hidden="true" className="size-3.5 fill-amber-500 text-amber-500" />{formatRating(averageRating)}
        <span className="text-muted-foreground">({reviewCount})</span>
        <span className="sr-only"> de 5, {reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'}</span>
      </span>}
```

- [ ] **Step 3: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add front/src/pages/roteiros/roteiro-detalhe.tsx front/src/pages/roteiros/itinerary-card.tsx
git commit -m "feat(front): avaliacoes no detalhe do roteiro e nota nos cards"
```

---

## Task 21: Front — ranking na Home (RF08)

**Files:**
- Modify: `front/src/pages/dashboard/dashboard.tsx`

- [ ] **Step 1: Seção "Roteiros mais bem avaliados"**

Em `front/src/pages/dashboard/dashboard.tsx`:

1. Abaixo de `const trips = useItineraries();`, adicionar:

```ts
  const topRated = useItineraries('top-rated');
```

2. Entre o fim da seção "Seus roteiros" (`</section>` após o `Feedback` "Nenhum roteiro salvo") e a seção "Para o seu jeito de viajar", inserir:

```tsx
    <section className="space-y-5" aria-labelledby="top-rated-title">
      <div className="page-header border-b border-border pb-4">
        <div className="space-y-2"><h2 id="top-rated-title" className="section-title">Roteiros mais bem avaliados</h2><p className="text-sm text-muted-foreground">Planos que outros viajantes aprovaram.</p></div>
      </div>
      {topRated.loading ? <CardSkeletons label="Carregando roteiros mais bem avaliados" /> : topRated.error ? <Feedback kind="error" title="Ranking indisponível" description={topRated.error} onRetry={topRated.refetch} /> : topRated.itineraries.length ? <div className="travel-grid">
        {topRated.itineraries.slice(0, 3).map(trip => <ItineraryCard key={trip.id} itinerary={trip} destinations={destinations.destinations} />)}
      </div> : <Feedback title="Nenhum roteiro avaliado ainda" description="Avalie seus roteiros prontos para inaugurar o ranking." />}
    </section>
```

- [ ] **Step 2: Build e lint**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add front/src/pages/dashboard/dashboard.tsx
git commit -m "feat(front): ranking de roteiros mais bem avaliados na Home"
```

---

## Task 22: Documentação (README do Nest e Insomnia)

**Files:**
- Modify: `backend-nest/README.md`
- Modify: `insomnia-viajero.json`

- [ ] **Step 1: README do backend-nest**

Substituir as seções `## Instalação` até `## Contrato de resposta` (exclusive) de `backend-nest/README.md` por:

````md
## Primeira execução

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
- **IDs:** `parseInt8: true` devolve `bigint` como `number`, igual ao DRF. Decimais continuam string (`"4.70"`).
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

````

e, em `## Limitações conhecidas da migração`, trocar a lista por:

```md
- Sem LLM real: a geração de roteiro (mock) e a sugestão de destino (heurística pelo DNA/interesses) são determinísticas.
- A descoberta de destino sem resultado local cria um destino básico (país "Desconhecido", sem POIs); o enriquecimento completo continua no Django.
- Sem refresh token: o access token expira em `JWT_ACCESS_MINUTES` e o front volta para o login.
```

- [ ] **Step 2: Request de avatar no Insomnia**

Em `insomnia-viajero.json`, inserir antes da linha `      "_id": "req_users_get",` (com o `{` que a precede — o novo objeto fica entre `req_users_me_patch` e `req_users_get`):

```json
    {
      "_id": "req_users_me_avatar",
      "_type": "request",
      "parentId": "fld_users",
      "name": "Me Avatar (POST)",
      "method": "POST",
      "url": "{{ base_url }}/api/users/me/avatar/",
      "headers": [
        { "name": "Authorization", "value": "Bearer {{ jwt }}" },
        { "name": "Content-Type", "value": "multipart/form-data" }
      ],
      "body": {
        "mimeType": "multipart/form-data",
        "params": [
          { "name": "avatar", "type": "file", "fileName": "" }
        ]
      },
      "description": "Somente backend-nest (porta 8001). Foto de perfil no campo avatar (PNG, JPG, WEBP ou GIF, ate 2 MB). Salva em backend-nest/uploads/avatars e grava a URL absoluta em avatar_url."
    },
```

- [ ] **Step 3: Validar o JSON**

Run: `python3 -c "import json; d=json.load(open('insomnia-viajero.json')); print(sum(1 for r in d['resources'] if r.get('_id')=='req_users_me_avatar'))"`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add backend-nest/README.md insomnia-viajero.json
git commit -m "docs: backend-nest com schema do Django, uploads, avaliacoes e smoke"
```

---

## Task 23: Verificação final

**Files:**
- Create (fora do repo): `<scratchpad>/browser-e2e.mjs`

- [ ] **Step 1: Unitários, lint e build do backend**

Run: `cd backend-nest && npx jest && npm run lint && npm run build`
Expected: todos PASS; lint limpo; build OK

- [ ] **Step 2: Build e lint do front**

Run: `cd front && npm run build && npm run lint && git checkout -- tsconfig.tsbuildinfo`
Expected: sem erros

- [ ] **Step 3: Smoke em banco recém-migrado**

Recriar o **Ambiente de teste** do zero (container novo, migrate + seed, `node dist/main.js` em background) e rodar `cd backend-nest && npm run smoke`.
Expected: `Smoke OK`

- [ ] **Step 4: Verificação no navegador**

Com o backend do passo 3 rodando, subir o front em background (`cd front && npm run dev`) e criar `<scratchpad>/browser-e2e.mjs`:

```js
// Fluxos do front contra o backend-nest real. Fora do repo.
// Uso: npm i playwright-core && FRONT_URL=http://localhost:5173 API_URL=http://localhost:8001 node browser-e2e.mjs
import { chromium } from 'playwright-core';

const FRONT = process.env.FRONT_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:8001';
const OUT = process.env.OUT_DIR ?? new URL('.', import.meta.url).pathname;
const RUN = Date.now();
const PASSWORD = 'senha-browser-123';
const problems = [];
let failures = 0;

function check(condition, label) {
  console.log(`${condition ? '  ok  ' : '  FAIL'} ${label}`);
  if (!condition) failures += 1;
}

async function api(method, route, { token, json } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${route}`, { method, headers, body: json ? JSON.stringify(json) : undefined });
  return response.json();
}

async function prepareUser(label, withProfile) {
  const email = `browser-${label}-${RUN}@viajero.dev`;
  const registered = await api('POST', '/api/auth/register/', { json: { email, password: PASSWORD, display_name: `Browser ${label}`, first_name: 'Browser', last_name: label } });
  const token = registered.data.access;
  if (withProfile) {
    await api('PATCH', '/api/traveler-dna/me/', { token, json: { travel_style: 'balanced', pace: 'moderate', comfort_level: 'mid', social_energy: 5, adventure_level: 5, food_focus: 6, cultural_interest: 8, nature_interest: 5, nightlife_interest: 4, notes: '' } });
    await api('PATCH', '/api/trip-preferences/me/', { token, json: { budget_min: 1500, budget_max: 4500, currency_code: 'BRL', companionship: 'solo', preferred_trip_length_days: 3, travel_month: 'dezembro', hotel_level: 'standard', transportation_style: 'public', dietary_preferences: [], accessibility_needs: [], interests: ['culture'], metadata: {} } });
  }
  return { email, token };
}

function watch(page, label) {
  page.on('pageerror', (error) => problems.push(`[${label}] pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`[${label}] console: ${message.text()}`);
  });
}

async function uiLogin(page, email) {
  await page.goto(`${FRONT}/login`);
  await page.locator('#email').fill(email);
  await page.locator('#senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Fazer login' }).click();
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const destinations = await api('GET', '/api/destinations/');
  const target = destinations.data.find((item) => (item.pois ?? []).length > 0);
  const owner = await prepareUser('dono', true);
  const visitor = await prepareUser('visitante', false);

  console.log('\n# Dono: login, criar roteiro e avaliar');
  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ownerContext.newPage();
  watch(page, 'dono');
  await uiLogin(page, owner.email);
  await page.waitForURL(`${FRONT}/`);
  check(await page.getByRole('heading', { name: 'Roteiros mais bem avaliados' }).isVisible(), 'Home mostra a seção de ranking');

  await page.goto(`${FRONT}/roteiros/criacao`);
  await page.getByRole('button', { name: /Já sei para onde vou viajar/ }).click();
  await page.locator('#destination-search').fill(target.name);
  await page.getByRole('button', { name: 'Buscar destino' }).click();
  await page.getByRole('button', { name: new RegExp(target.name) }).filter({ hasText: 'Selecionar' }).first().click();
  await page.getByRole('button', { name: 'Gerar roteiro para este destino' }).click();
  await page.waitForURL(/\/roteiros\/\d+$/, { timeout: 30000 });
  const itineraryId = Number(page.url().split('/').pop());
  await page.getByRole('heading', { name: 'Dias do roteiro' }).waitFor();
  check(await page.getByText('3 dias').first().isVisible(), 'duração vem das preferências (3 dias)');
  await page.getByRole('link', { name: 'Avaliar roteiro' }).click();
  check(await page.getByText('Como foi sua viagem?').isVisible(), 'formulário do dono');
  await page.getByRole('button', { name: 'Publicar avaliação' }).click();
  check(await page.getByText('Escolha uma nota de 1 a 5.').isVisible(), 'validação exige nota');
  await page.locator('label[for="review-rating-5"]').click();
  await page.locator('#review-title').fill('Viagem redonda');
  await page.locator('#review-body').fill('Dias bem distribuídos.');
  await page.getByRole('button', { name: 'Publicar avaliação' }).click();
  await page.getByText('(você)').waitFor();
  check(await page.getByText('(1 avaliação)').isVisible(), 'resumo com 1 avaliação');
  await page.screenshot({ path: `${OUT}/detalhe-dono.png`, fullPage: true });

  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.locator('label[for="review-rating-4"]').click();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await page.getByText('(você)').waitFor();
  await page.getByRole('img', { name: 'Nota 4,0 de 5' }).first().waitFor();
  check(true, 'média 4,0 após edição');

  await page.goto(`${FRONT}/`);
  const ranking = page.getByRole('region', { name: 'Roteiros mais bem avaliados' });
  await ranking.getByRole('link', { name: /Abrir roteiro/ }).first().waitFor();
  check(true, 'ranking da Home lista o roteiro avaliado');
  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  console.log('\n# Perfil: Sidebar reflete a edição');
  await page.goto(`${FRONT}/perfil`);
  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.getByLabel('Nome de exibição').fill('Browser Dono Renomeado');
  await page.getByRole('button', { name: 'Salvar alterações' }).first().click();
  await page.getByText('Perfil atualizado com sucesso!').waitFor();
  check(await page.getByRole('link', { name: /Browser Dono Renomeado/ }).isVisible(), 'Sidebar mostra o nome novo');

  console.log('\n# Visitante: roteiro público, avaliar e excluir');
  const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitorPage = await visitorContext.newPage();
  watch(visitorPage, 'visitante');
  await uiLogin(visitorPage, visitor.email);
  await visitorPage.waitForURL(`${FRONT}/onboard`);
  await visitorPage.goto(`${FRONT}/roteiros/${itineraryId}`);
  await visitorPage.getByRole('heading', { name: 'Avaliações' }).waitFor();
  check(await visitorPage.getByText('Avalie este roteiro').isVisible(), 'formulário do visitante');
  check(await visitorPage.getByText('Viagem redonda').isVisible(), 'visitante vê a avaliação do dono');
  await visitorPage.locator('label[for="review-rating-2"]').click();
  await visitorPage.getByRole('button', { name: 'Publicar avaliação' }).click();
  await visitorPage.getByText('(você)').waitFor();
  check(await visitorPage.getByText('(2 avaliações)').isVisible(), 'resumo com 2 avaliações');
  await visitorPage.screenshot({ path: `${OUT}/detalhe-visitante-mobile.png`, fullPage: true });
  await visitorPage.getByRole('button', { name: 'Excluir' }).click();
  await visitorPage.getByRole('button', { name: 'Excluir avaliação' }).click();
  await visitorPage.getByText('(1 avaliação)').waitFor();
  check(true, 'exclusão volta para 1 avaliação');

  console.log('\n# Sessão expirada');
  await page.evaluate(() => localStorage.setItem('viajero.access_token', 'token-expirado'));
  await page.goto(`${FRONT}/roteiros`);
  await page.waitForURL(`${FRONT}/login`, { timeout: 15000 });
  check(await page.getByText('Sua sessão expirou. Entre novamente para continuar.').isVisible(), 'login mostra o aviso de sessão expirada');
} catch (error) {
  failures += 1;
  console.error('  FAIL fluxo interrompido:', error.message);
} finally {
  await browser.close();
}

const unexpected = problems.filter((line) => !/status of 4\d\d/.test(line));
for (const line of unexpected) console.log(`  FAIL ${line}`);
failures += unexpected.length;
console.log(failures === 0 ? '\nNavegador OK' : `\nNavegador falhou: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
```

Run: `cd <scratchpad> && npm i playwright-core && node browser-e2e.mjs`
Expected: todas `ok` e `Navegador OK`; conferir visualmente `detalhe-dono.png`, `home.png` e `detalhe-visitante-mobile.png`

- [ ] **Step 5: Limpeza**

Parar o Vite e o Nest em background; `docker rm -f viajero-nest-it`; `rm -rf backend-nest/uploads`; `git status` limpo (exceto os `Matriz-RACI-*` que já estavam fora do controle).

- [ ] **Step 6: Revisão final**

Usar `superpowers:requesting-code-review` no diff da branch e só então reportar ao usuário.
