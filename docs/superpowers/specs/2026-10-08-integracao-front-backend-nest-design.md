# Integração do novo front com o backend-nest + Avaliações de roteiros

**Data:** 2026-10-08
**Status:** Aprovado para implementação
**Escopo:** `backend-nest/` (NestJS + TypeORM) e `front/` (React 19 + Vite). Backend Django (`backend/`) não é alterado.

## Contexto

O front novo (`front/`, branch `new-front`) foi desenvolvido contra um mock (`src/mock-backend.ts`) que imita o contrato do backend Django. O alvo agora é o `backend-nest`, apresentado como migração funcional do Django e que lê o **mesmo schema PostgreSQL criado pelas migrations do Django**.

Diagnóstico feito rodando o backend-nest contra um Postgres descartável (migrations + `seed_data.json` do Django) e repetindo, via HTTP, exatamente as chamadas do front:

| # | Problema | Evidência |
|---|---|---|
| 1 | Schema do Django não tem `DEFAULT` em nenhuma coluna; o TypeORM envia `DEFAULT` para propriedades omitidas → NOT NULL violado | `POST /api/auth/register` → 500 `null value in column "date_joined"`; `POST /api/auth/login` → 500 `null value in column "created_at" of relation "audit_auditlog"` |
| 2 | `bigint` volta como string (`"id": "1"`) | `POST /api/itineraries` com `destination: "1"` → 400 `destination must be an integer number` |
| 3 | `POST /api/itineraries` exige `duration_days`; o front não envia (o Django completava pelas preferências) | 400 `duration_days must be an integer number` |
| 4 | Endpoints chamados pelo front inexistentes | `PATCH /api/itineraries/:id`, `POST /api/destinations/suggest`, `POST /api/users/me/avatar` → 404 |
| 5 | Regerar roteiro com dias: FKs do Django são `NO ACTION` | `POST /api/itineraries/:id/generate` (2ª vez) → 500 FK `itinerarydailyevent` |
| 6 | `templates`/`top-rated` públicos retornam roteiros privados de qualquer usuário | `GET /api/itineraries/top-rated` sem JWT lista roteiro recém-criado de outro usuário |
| 7 | `GET /api/reviews` público carrega `user` inteiro | resposta inclui `password` (hash) e `email` do autor |
| 8 | Reviews: duplicata → 500 (unique), sem PATCH/DELETE, sem checagem de visibilidade, stats só na criação | código de `ItinerariesService.createReview` |
| 9 | Mensagens em inglês/genéricas chegam à UI | 401 `Unauthorized`; login mostra `errors.detail` `Invalid credentials.`; email duplicado → `Nao foi possivel processar a solicitacao.` |
| 10 | Token expira em 60 min, sem refresh; front não trata 401 | telas ficam presas em erro até logout manual |
| 11 | `is_profile_complete` nunca vira `true`; Sidebar não reflete edição do perfil | banner "perfil incompleto" permanente; nome/avatar antigos na Sidebar |

Baseline: `front` build + lint OK; `backend-nest` build OK, 2 testes Jest OK, `npm run lint` quebrado (padrão `test/**/*.ts` sem arquivos).

## Decisões fechadas

| Decisão | Escolha |
|---|---|
| Onde corrigir o contrato | **Backend-nest honra o contrato do front/Django.** Front muda só onde está errado (erros, 401, sync de usuário, mock) |
| Defaults do banco | **Subscriber global do TypeORM** (`beforeInsert`) reproduz defaults das entities, como o Django faz em Python. Schema do Django intocado |
| IDs | `bigint` continua string (padrão do TypeORM); DTOs convertem ids recebidos como string (`ToId`). *Revisado na implementação: `parseInt8` conflita com o bugfix #720 do TypeORM, ver 1.2* |
| Avatar | **Upload no Nest** (multipart, disco em `backend-nest/uploads`, servido em `/uploads`) |
| Sugestão de destino | **Heurística determinística no Nest** (sem LLM) |
| Mock do front | **Remover** `mock-backend.ts` e o bootstrap `VITE_MOCK_API` |
| Sessão expirada | **401 em requisição autenticada → logout + `/login` com aviso** (sem refresh token) |
| Avaliações — visibilidade | Roteiro **público** = `ready` e (`review_count > 0` ou `metadata.is_template = true`). Dono avalia o próprio roteiro pronto; qualquer usuário logado avalia roteiros públicos. 1 avaliação por usuário/roteiro, editável e excluível |
| Avaliações — tela | **Seção "Avaliações" no detalhe do roteiro** + seção **"Roteiros mais bem avaliados"** na Home (RF08) |
| Commits | Sem trailer `Co-Authored-By` (regra do repositório); sem push |

## Arquitetura

### Árvore de arquivos (novos/modificados)

```
backend-nest/
├── .gitignore                                   [NOVO] uploads/
├── package.json                                 [MOD] lint corrigido; script smoke
├── README.md                                    [MOD] endpoints, uploads, smoke
├── scripts/
│   └── smoke-contract.mjs                       [NOVO] smoke HTTP do contrato do front (Node fetch)
└── src/
    ├── main.ts                                  [MOD] NestExpressApplication + /uploads estático
    ├── database/
    │   ├── typeorm.config.ts                    [MOD] parseInt8 + subscriber
    │   ├── django-defaults.subscriber.ts        [NOVO]
    │   └── __tests__/django-defaults.subscriber.spec.ts [NOVO]
    ├── common/
    │   ├── uploads.ts                           [NOVO] pasta/URL de uploads
    │   ├── api-exception.filter.ts              [MOD] mensagens PT, log 5xx, sem vazar SQL
    │   ├── facades/itinerary-generation.facade.ts [MOD] falha → roteiro failed + erro PT
    │   └── __tests__/api-exception.filter.spec.ts [NOVO]
    └── modules/
        ├── auth/auth.service.ts                 [MOD] mensagens PT (duplicado/credenciais)
        ├── users/
        │   ├── users.controller.ts              [MOD] POST me/avatar
        │   ├── users.service.ts                 [MOD] setAvatar; mensagens PT
        │   └── avatar-upload.ts                 [NOVO] opções do multer (tipos, limite, nome)
        ├── profiles/
        │   ├── dto/update-traveler-dna.dto.ts   [NOVO] PATCH validado (campos opcionais)
        │   ├── dto/update-trip-preference.dto.ts [NOVO]
        │   ├── traveler-dna.controller.ts       [MOD] usa DTO de update
        │   ├── trip-preferences.controller.ts   [MOD] usa DTO de update
        │   ├── profiles.module.ts               [MOD] User no forFeature
        │   └── profiles.service.ts              [MOD] is_profile_complete
        ├── destinations/
        │   ├── destinations.controller.ts       [MOD] POST suggest (JWT)
        │   ├── destinations.module.ts           [MOD] registra DestinationSuggestionService
        │   ├── destination-suggestion.ts        [NOVO] scoring puro
        │   ├── destination-suggestion.service.ts [NOVO]
        │   ├── destinations.service.ts          [MOD] mensagens PT
        │   └── __tests__/destination-suggestion.spec.ts [NOVO]
        ├── itineraries/
        │   ├── dto/create-itinerary.dto.ts      [MOD] duration_days/title opcionais
        │   ├── dto/update-itinerary.dto.ts      [NOVO]
        │   ├── dto/create-review.dto.ts         [MOD] limites de tamanho
        │   ├── dto/update-review.dto.ts         [NOVO]
        │   ├── itinerary-rules.ts               [NOVO] defaults de criação + visibilidade (puros)
        │   ├── review.presenter.ts              [NOVO] review sem dados sensíveis
        │   ├── itineraries.controller.ts        [MOD] PATCH :id; retrieve público com is_owner
        │   ├── itineraries.service.ts           [MOD] create c/ defaults, update, findVisible, top-rated/templates (sai a parte de reviews)
        │   ├── reviews.service.ts               [NOVO] CRUD de avaliacoes + ReviewStat + auditoria
        │   ├── reviews.controller.ts            [MOD] PATCH/DELETE :id; presenter
        │   └── __tests__/itinerary-rules.spec.ts, review.presenter.spec.ts [NOVOS]
        └── ai/ai.service.ts                     [MOD] regeneração transacional; falha → status failed

front/
├── README.md                                    [MOD] sem mock; como rodar com backend-nest
└── src/
    ├── main.tsx                                 [MOD] remove bootstrap do mock
    ├── mock-backend.ts                          [REMOVIDO]
    ├── lib/api.ts                               [MOD] mensagem do backend; 401 → evento de sessão
    ├── lib/auth.ts                              [MOD] persistUser; evento de sessão expirada
    ├── lib/reviews.ts                           [NOVO]
    ├── lib/itineraries.ts                       [MOD] fetchTopRated
    ├── contexts/authContext.tsx                 [MOD] escuta sessão expirada; updateUser
    ├── types/travel.ts                          [MOD] Review, ReviewStats, is_owner
    ├── hooks/useReviews.ts                      [NOVO]
    ├── components/ui/star-rating.tsx            [NOVO] StarRating (leitura) + StarRatingInput (radios)
    ├── features/reviews/review-form.tsx         [NOVO]
    ├── features/reviews/review-list.tsx         [NOVO]
    ├── features/reviews/reviews-section.tsx     [NOVO]
    ├── pages/login/login.tsx                    [MOD] usa message; aviso de sessão expirada
    ├── pages/user-profile/user.tsx              [MOD] sync do usuário após PATCH/avatar; erro do avatar
    ├── pages/roteiros/roteiro-detalhe.tsx       [MOD] seção Avaliações + atalho "Avaliar roteiro"
    ├── pages/roteiros/itinerary-card.tsx        [MOD] badge de nota
    └── pages/dashboard/dashboard.tsx            [MOD] "Roteiros mais bem avaliados"

insomnia-viajero.json                            [MOD] avatar (multipart)
```

## 1. Fundação do backend-nest

### 1.1 `DjangoDefaultsSubscriber`

`EntitySubscriberInterface` global com `beforeInsert(event)`. Para cada coluna de `event.metadata.columns` cujo valor na entity é `undefined`:

- ignora: coluna gerada (`isGenerated`), coluna de relação (`relationMetadata`), coluna virtual;
- `isCreateDate` / `isUpdateDate` → `new Date()`;
- `column.default` definido → valor resolvido por `resolveColumnDefault`:
  - função → executa; `"'{}'"` → `{}`, `"'[]'"` → `[]`, `CURRENT_TIMESTAMP`/`now()` → `new Date()`;
  - literal (`''`, `'BRL'`, `0`, `false`, `90`…) → o próprio valor;
- coluna anulável sem default → mantém `undefined` (vira `NULL`).

Coluna obrigatória sem default (ex.: `duration_days`) continua falhando — validação é do domínio. Mudanças feitas em `beforeInsert` são recomputadas pelo TypeORM antes do INSERT (mesmo mecanismo de `@BeforeInsert`). Todo o código Nest persiste via `repository.save()`, que dispara o subscriber. Registro em `typeorm.config.ts` (`subscribers: [DjangoDefaultsSubscriber]`).

### 1.2 IDs

**Revisado na implementação.** O plano original ligava `parseInt8: true`. O smoke mostrou que o TypeORM converte ids `bigint` gerados em string após o INSERT (bugfix #720, em `ColumnMetadata.createValueMap`). Com `parseInt8`, ids lidos viram `number` e os gerados continuam `string`; ao salvar uma entity com relação one-to-many carregada, o TypeORM compara `5` com `"5"`, conclui que os filhos saíram e tenta anular a FK (500 na regeneração). Decisão: manter o padrão do TypeORM (`bigint` como string, internamente consistente) e converter ids numéricos recebidos como string nos DTOs (`ToId` em `common/validation.ts`). O front já compara ids via `String(...)`; `presentUser`/`presentReview` devolvem `number`. `decimal` continua string (`"4.70"`), igual ao DRF.

### 1.3 `ApiExceptionFilter`

- Mensagem: usa a mensagem lançada pelo código; se for padrão em inglês do Nest/Passport/Multer (`Unauthorized`, `Forbidden resource`, `Not Found`, `Cannot <MÉTODO> <rota>`, `Payload Too Large`, `File too large`, `Unexpected field`, `Bad Request`…) ou lista do class-validator, troca pela mensagem PT do status:

| Status | Mensagem |
|---|---|
| 400 | `Dados invalidos. Verifique os campos enviados.` |
| 401 | `Sessao expirada ou nao autenticada. Entre novamente.` |
| 403 | `Voce nao tem permissao para esta acao.` |
| 404 | `Recurso nao encontrado.` |
| 409 | `A solicitacao conflita com o estado atual do recurso.` |
| 413 | `Arquivo muito grande. O limite e 2 MB.` |
| ≥500 | `Nao foi possivel processar a solicitacao.` |

- `errors`: 4xx mantém o corpo original (detalhe de validação); 5xx retorna `{}` e o erro vai para `Logger.error` com stack (hoje é engolido e o SQL vaza na resposta).
- Mensagens lançadas pelos services passam a PT sem acento, seguindo a convenção: `Roteiro nao encontrado.`, `Destino nao encontrado.`, `Usuario nao encontrado.`, `Dia do roteiro nao encontrado.`, `Ja existe um usuario cadastrado com este email.` (mantém `errors.email`), `Email ou senha invalidos.` (`detail` e `message`).

## 2. Contrato que o front já usa

### 2.1 `POST /api/itineraries` com defaults (paridade Django)

DTO: `destination` (int, obrigatório), `title`/`duration_days`/`budget_total`/`currency_code`/`summary`/datas opcionais. Função pura `resolveItineraryDefaults(dto, preferences, destination)`:

- `duration_days` = dto ?? `preferred_trip_length_days` se 1–60 ?? **5**;
- `budget_total` = dto ?? média de `budget_min`/`budget_max` das preferências ?? `0`;
- `currency_code` = dto ?? moeda das preferências ?? `BRL`;
- `title` = dto (trim, não vazio) ?? `Roteiro <nome do destino>`.

Destino inexistente → 404 `Destino nao encontrado.` (hoje vira 500 de FK).

### 2.2 `PATCH /api/itineraries/:id` (JWT, só dono)

`UpdateItineraryDto` (todos opcionais): `title` (≤160), `summary`, `start_date`/`end_date` (data ISO ou `null`), `duration_days` (1–60), `budget_total` (≥0), `currency_code` (3 letras). Campos fora do DTO são descartados (`whitelist`). `end_date < start_date` (considerando valores atuais) → 400 `A data final nao pode ser anterior a data inicial.` Resposta: roteiro recarregado.

### 2.3 `POST /api/destinations/suggest` (JWT)

`DestinationSuggestionService` carrega DNA, preferências, destinos (com POIs/tags/custo) e ids de destinos já usados nos roteiros do usuário. Scoring puro em `destination-suggestion.ts`:

- categorias por POI: `culture` (tags `cultura`, `historia`), `food` (`gastronomia`), `nature` (`natureza`, `praia`), `nightlife` (`noturno`), `shopping` (`compras`), `wellness` (`praia`), `adventure` (`poi_type = activity`);
- peso da categoria = escala do DNA ÷ 10 (`cultural_interest`, `food_focus`, `nature_interest`, `nightlife_interest`, `adventure_level`; sem DNA → 0,5; `shopping`/`wellness` → 0) **+ 0,5** se a categoria está em `preferences.interests`;
- afinidade do destino na categoria = `min(1, POIs da categoria ÷ 2)`;
- `score = Σ peso × afinidade + 0,5 × average_rating ÷ 5`;
- exclui destinos já usados (se sobrar nenhum, considera todos); desempate: maior `average_rating`, depois nome.

Resposta: destino no mesmo formato de `GET /api/destinations/:id`, mensagem `Destino sugerido com base no seu perfil: <nome>.`. Auditoria `destination.suggested` (metadata: `score`). Sem destinos → 404 `Nenhum destino disponivel para sugerir no momento.`

### 2.4 `POST /api/users/me/avatar` (JWT)

- `FileInterceptor('avatar')` (multer já incluso em `@nestjs/platform-express`), `diskStorage` em `<cwd>/uploads/avatars` (cria a pasta), nome `<userId>-<timestamp>.<ext>` com extensão derivada do mimetype — nunca o nome do cliente;
- aceita `image/png`, `image/jpeg`, `image/webp`, `image/gif` (SVG recusado); limite 2 MB → 413; tipo inválido → 400 `Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.`; sem arquivo → 400 `Selecione uma imagem.`;
- `avatar_url` = `<protocolo>://<host da requisição>/uploads/avatars/<arquivo>` (cabe nos 200 caracteres da coluna); resposta = usuário apresentado, mensagem `Avatar atualizado com sucesso.`;
- `main.ts`: `NestExpressApplication.useStaticAssets(<cwd>/uploads, { prefix: '/uploads/' })` com `X-Content-Type-Options: nosniff`;
- avatar antigo não é apagado (fora do escopo).

## 3. Correções secundárias no backend-nest

- **Regeneração** (`AiService.runJob`): escrita do roteiro (campos, remoção de eventos → dias, inserção de dias/eventos) dentro de uma transação; eventos são removidos antes dos dias. Qualquer falha: transação desfeita, job `failed` + `error_message`, roteiro `failed`; a facade responde 500 `Nao foi possivel gerar o roteiro. Tente novamente.` (o front já trata `failed`).
- **`templates`**: `ready` e `metadata @> {"is_template": true}`.
- **`top-rated`**: `ready` e `review_stats.review_count > 0`, ordenado por `average_rating` desc, `review_count` desc, `updated_at` desc; limite 10; inclui `destination` e `review_stats`.
- **`is_profile_complete`**: após upsert de DNA ou preferências, se o usuário tem os dois, marca `true`.
- **PATCH de DNA/preferências validado**: hoje o `@Body()` é `Partial<Dto>` (o `ValidationPipe` não valida nem descarta campos), então um corpo com `id` sobrescreve o registro de outro usuário. Passa a usar DTOs de update com campos opcionais validados (`whitelist` descarta `id`/`user`).

## 4. Avaliações (US-13 / RF08)

### 4.1 Regras (`itinerary-rules.ts`, funções puras)

- `isPublicItinerary(it)` = `generation_status === 'ready'` e (`review_stats.review_count > 0` ou `metadata.is_template === true`).
- `canViewItinerary(it, userId)` = dono ou público.
- `canReviewItinerary(it, userId)` = `generation_status === 'ready'` e `canViewItinerary`.

Avaliar o próprio roteiro o torna público (anônimo) — a UI avisa antes do envio.

### 4.2 Endpoints

| Método | Rota | Auth | Comportamento |
|---|---|---|---|
| GET | `/api/reviews?itinerary=ID` | pública | Lista (mais recentes primeiro), via presenter. Sem `itinerary`: últimas 100 de todos os roteiros (só existem avaliações em roteiros públicos) |
| POST | `/api/reviews` | JWT | `{itinerary, rating 1–5, title? ≤120, body? ≤2000}`. Roteiro não visível → 404 `Roteiro nao encontrado.`; não pronto → 400 `So e possivel avaliar roteiros prontos.`; já avaliado → 409 `Voce ja avaliou este roteiro.`. 201 |
| PATCH | `/api/reviews/:id` | JWT, só autor | `rating`/`title`/`body` opcionais. Não é autor → 404 `Avaliacao nao encontrada.` |
| DELETE | `/api/reviews/:id` | JWT, só autor | Remove; `data: null` |
| GET | `/api/itineraries/:id` | JWT | Dono **ou** roteiro público; resposta inclui `is_owner` |

Toda escrita recalcula `ReviewStat` (`COUNT`/`AVG` → upsert; sem avaliações → `review_count 0`, sai do ranking) e audita `review.created` / `review.updated` / `review.deleted` (metadata: `itinerary_id`, `rating`).

### 4.3 Presenter

`presentReview(review)` → `{ id, itinerary, rating, title, body, created_at, updated_at, user: { id, display_name, avatar_url } }` — `itinerary` é o id; `display_name` cai para `first_name`/`username` se vazio. Nunca expõe `password`, `email` ou flags.

## 5. Front

### 5.1 Cliente HTTP e sessão

- `apiFetch`: mensagem de erro = `message` do backend → `detail` → fallback. 401 em requisição que levou `Authorization` → mensagem `Sua sessão expirou. Entre novamente para continuar.` e `window.dispatchEvent(new Event('viajero:session-expired'))`.
- `AuthProvider` escuta o evento: `logout()` e guarda o aviso; `PrivateRoute` redireciona para `/login`, que mostra o aviso.
- Login exibe `error.message` (não mais `errors.detail`).
- `AuthContext.updateUser(user)` persiste no `localStorage` e atualiza o contexto; o perfil chama após `PATCH /api/users/me` e após o upload de avatar (Sidebar reflete na hora). Erro do avatar mostra a mensagem do backend.

### 5.2 Remoção do mock

Apaga `src/mock-backend.ts` e o bloco `VITE_MOCK_API` do `main.tsx`; README sem a seção do mock e com o passo a passo para rodar com o backend-nest.

### 5.3 Avaliações

- **`lib/reviews.ts`**: `listReviews(itineraryId, signal)`, `createReview`, `updateReview`, `deleteReview`.
- **`hooks/useReviews(itineraryId)`**: carrega via `useAsyncResource`; expõe `reviews`, `loading`, `error`, `refetch`, `create/update/remove` com estado `saving`/`saveError`.
- **`components/ui/star-rating.tsx`**:
  - `StarRating` (leitura): estrelas Lucide preenchidas por nota, `aria-label="Nota 4,5 de 5"`;
  - `StarRatingInput`: `fieldset` + `legend` + 5 `input type="radio"` (setas do teclado nativas), estrelas como rótulo, alvo ≥ 44 px, foco visível.
- **`features/reviews/review-form.tsx`**: react-hook-form + zod (nota obrigatória 1–5; título ≤120; comentário ≤2000), modos criar/editar, aviso de publicidade do ranking, erros por campo e do servidor.
- **`features/reviews/review-list.tsx`**: item com inicial/avatar, nome, estrelas, data (`pt-BR`), título, corpo; ações Editar/Excluir só na avaliação do usuário (excluir confirma com o `Dialog` existente).
- **`features/reviews/reviews-section.tsx`** (`id="avaliacoes"`): resumo (média + total do `review_stats`), "Sua avaliação" (form ou card com ações), lista das demais, estados carregando/vazio ("Seja o primeiro a avaliar")/erro com "Tentar novamente". Após mutação: recarrega a lista e o roteiro (stats atualizados).
- **Detalhe do roteiro**: seção ao fim; atalho "Avaliar roteiro" no cabeçalho (âncora `#avaliacoes`) quando `canReview`. No front, `canReview = generation_status === 'ready'` (se o usuário consegue abrir o roteiro, ele é dono ou o roteiro é público) e "já avaliei" = existe review com `user.id` igual ao usuário logado. Texto do formulário muda para dono (`is_owner`: "Como foi sua viagem?") vs. visitante ("Avalie este roteiro").
- **Home**: seção "Roteiros mais bem avaliados" usando `GET /api/itineraries/top-rated` (estados carregando/vazio/erro); cards abrem o detalhe.
- **`ItineraryCard`**: badge `★ 4,5 (3)` quando `review_stats.review_count > 0`.

Padrões visuais: tokens e classes já existentes (`badge`, `travel-card`, `section-title`, `Feedback`, `Button`, `Input`), textos em PT com acentos (UI) e foco/teclado acessíveis.

## 6. Documentação

- `backend-nest/README.md`: endpoints novos, `uploads/`, explicação do subscriber/`parseInt8`, `npm run smoke`.
- `front/README.md`: como rodar contra o backend-nest; remove mock e o link quebrado para `RODAR_LOCALMENTE.md`.
- `insomnia-viajero.json`: request de avatar (multipart). Suggest, PATCH de roteiro e PATCH/DELETE de review já existem. Base URL continua 8000; README explica trocar para 8001.
- `backend-nest/package.json`: `lint` só em `src/**/*.ts`; `smoke`.

## 7. Testes e verificação

- **Jest (backend-nest)**: `resolveColumnDefault`/subscriber; `ApiExceptionFilter` (mapeamento PT, 5xx sem vazamento); `resolveItineraryDefaults`; regras de visibilidade; scoring de sugestão; `presentReview` sem `password`/`email`.
- **Smoke HTTP (`scripts/smoke-contract.mjs`)**: contra banco **recém-migrado pelo Django, sem defaults simulados**: cadastro, login, DNA, preferências, PATCH usuário, avatar, destinos, busca, sugestão, criar roteiro com o payload do front (`{destination, title}`), PATCH datas, gerar, detalhe, regerar, listar; dono avalia → aparece em `top-rated` → usuário B vê detalhe público e avalia → média recalculada → B edita e exclui → B não edita avaliação do dono → duplicata 409 → `GET /api/reviews` sem `password`/`email`; 401 com mensagem PT.
- **Front**: `npm run build` + `npm run lint`; verificação no Chrome (playwright-core fora do repo) dos fluxos: cadastro → onboarding → preferências → criar roteiro → detalhe → avaliar/editar/excluir → Home com ranking; sessão expirada redireciona ao login.

## Fora do escopo

- LLM real (Groq/Gemini) no Nest; refresh token.
- Descoberta "stub" de destino (cria país "Desconhecido" sem POIs) e textos do gerador mock em inglês — herdados do Django.
- Limpeza de avatares antigos; paginação de avaliações; moderação.

## Riscos

- Subscriber só atua em `save()` (não em `QueryBuilder.insert()`); o código atual não usa inserts via QueryBuilder — documentar no README.
- Avaliar torna o roteiro público: mitigado pelo aviso explícito na UI e pela ausência de dados do dono na resposta.
- `avatar_url` absoluto depende do host da requisição; atrás de proxy pode exigir ajuste futuro.
