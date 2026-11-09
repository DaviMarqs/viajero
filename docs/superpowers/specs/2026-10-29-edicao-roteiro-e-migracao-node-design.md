# Edição do roteiro no servidor (#50) e conclusão da migração para Node (#48)

Data: 29/10/2026 · Branch: `feat/edicao-roteiro-migracao-node`

## Objetivo

1. **#50 Editar Roteiro** (cards #75–#79): a programação editada passa a ser gravada no servidor, com salvamento automático, desfazer e mover atividades entre dias.
2. **#48 Refatorar o backend para Node** (cards #54–#59, #63, #65–#67): o NestJS fica autossuficiente. Paridade de endpoints com o Django, migrations e seed próprios, testes e2e, CI e o Django fora do caminho de execução.

Fora do escopo: #49 (troca de atividade por IA), adicionar ou remover dias, editar texto ou custo de uma atividade, compartilhamento público por token (RF07).

## Parte A: edição no servidor (#50)

### Backend
Os endpoints novos exigem JWT, aceitam só o dono e só roteiro com `generation_status = 'ready'`. Ficam num controller próprio (`itinerary-program.controller.ts`), com a lógica pura em `itinerary-program.ts`.

| Rota | Corpo | Efeito |
|---|---|---|
| `PUT /api/itineraries/:id/program` | `{ days: [{ day_number, event_ids: number[] }] }` | Aplica o layout completo: reordena, move entre dias e apaga os eventos ausentes |
| `POST /api/itineraries/:id/program/undo` | — | Restaura o último snapshot; sem histórico responde 409 |

Regras do layout (400 com mensagem em PT quando violadas):
- Contém exatamente os `day_number` atuais. Dias não são criados nem removidos, então a duração continua consistente.
- Cada `event_id` pertence ao roteiro e aparece uma vez só. Eventos atuais ausentes do layout são apagados.
- Os horários são recalculados no servidor com a mesma regra de `front/src/features/itineraries/itinerary-schedule.ts`:
  - O dia começa no menor `start_time` original dele, ou às 09:00 se não houver.
  - A duração é `end − start` do próprio evento, senão `poi.estimated_visit_minutes`, senão 90 min.
  - Há 30 min de deslocamento entre atividades.
  - Passar da meia-noite resulta em 400.
- `order_index` = posição no dia. `estimated_cost` do dia = soma dos eventos. `budget_total` = soma dos dias.
- Tudo numa transação. Os eventos que ficam são atualizados no lugar e mantêm o id.

Desfazer (padrão Memento):
- Antes de cada alteração, o servidor guarda um snapshot em `itinerary.metadata.program_history`, com no máximo 10 entradas.
- O snapshot contém `title`, `start_date`, `end_date`, `budget_total` e os dias com os eventos completos: id, título, descrição, custo, ordem, horários e `poi_id`.
- Alterações que geram snapshot: `PUT /program` e o `PATCH /api/itineraries/:id` quando muda título ou datas de um roteiro `ready`.
- O `undo` reconcilia o estado atual com o snapshot. Eventos que ainda existem são atualizados; eventos removidos depois do snapshot são recriados (com id novo); eventos que não estão no snapshot são apagados. Título, datas, custos dos dias e total são restaurados.
- Uma geração completa (`runJob`) limpa o `program_history`.
- Auditoria: `itinerary.program_updated` e `itinerary.program_undone`.

Duração: no `PATCH`, quando o resultado tem `start_date` e `end_date`, `end − start + 1` precisa ser igual a `duration_days`; caso contrário, 400.

### Front
- "Editar roteiro" vira um modo de edição com "Concluir edição". Saem Salvar e Cancelar.
- Indicador de status: "Salvando…", "Todas as alterações salvas" ou "Erro ao salvar" com "Tentar de novo".
- Ações:
  - Reordenar arrastando dentro do dia, como hoje.
  - Mover para outro dia por um menu "Mover para o dia…"; a atividade vai para o fim do dia escolhido.
  - Remover.
- Cada ação atualiza a tela na hora e entra numa fila sequencial de `PUT /program`. A resposta do servidor substitui o estado quando não há ação pendente mais nova.
- Nome: debounce de 800 ms e `PATCH`. A data de ida é editável e a de volta é calculada (`ida + duração − 1`).
- "Desfazer": espera a fila esvaziar, chama `/program/undo` e aplica a resposta. Os toasts de remoção e de movimentação também oferecem "Desfazer".
- Removem-se `readLocalProgram`, `saveLocalProgram` e `localProgramKey`. Na carga, a chave antiga `viajero.*.itinerary.*.program` é apagada do `localStorage`.
- O painel de custo usa o `budget_total` do servidor, que já vem recalculado.
- A lógica pura (montagem do layout, mover e remover, fila) fica em `front/src/features/itineraries/program-sync.ts`, testada com `node:test`.

## Parte B: paridade de endpoints (#56–#59, #63)

Helper comum `backend-nest/src/common/query/list-query.ts`:
- Lê `search`, `ordering` (lista separada por vírgula, `-` para descendente), `page`, `page_size` (padrão 12, máximo 100) e filtros por campo de uma lista permitida.
- **Paginação opcional**: sem `page`, a lista continua vindo como array, que é o que o front consome hoje. Com `page`, vem `{ count, next, previous, results }`, como no Django.
- Campos fora da lista permitida são ignorados.

| Recurso | Novo no Nest | Filtros / busca / ordenação (iguais aos do Django) |
|---|---|---|
| users | `GET/PUT/PATCH /api/users/:id` (o próprio usuário ou staff; o Django era AllowAny, o que é uma falha de segurança) | — |
| destinations | `PUT/PATCH/DELETE /:id` (só staff) | `country`, `city` · `name,country,city,summary` · `name,average_rating,created_at` |
| pois | `POST` e `GET/PUT/PATCH/DELETE /:id` (escrita só staff, leitura pública) | `destination`, `poi_type`, `tags__slug` · `name,summary,address` · `name,rating,estimated_visit_minutes` |
| traveler-dna, trip-preferences | `POST` na raiz e `GET/PUT/PATCH/DELETE /:id` (só o dono) | — |
| itineraries | `PUT/DELETE /:id` (dono). O DELETE apaga os dependentes na ordem certa, porque as FKs do Django são NO ACTION | `destination`, `generation_status` · `title,summary` · `created_at,budget_total,duration_days` |
| favorites | `GET/PUT/PATCH /:id` (dono) | — |
| reviews | `GET /:id` (visível), `PUT /:id` (autor) | `itinerary`, `rating` · — · `created_at,rating` |
| shared-links | `GET/PUT/PATCH/DELETE /:id` (criador) | — |
| audit-logs | 403 para quem não é staff, `GET /:id` | `event_type`, `content_type` · — · `created_at` |

Rotas que já existem não mudam de contrato, para não quebrar o front. Auditoria que faltava: `itinerary.generated`, `user.profile_updated`, `traveler_dna.created/updated` e `trip_preferences.created/updated`.

## Parte C: schema, seed e Django desligado (#54, #55, #67)

- **Migrations TypeORM** em `backend-nest/src/database/migrations`, registradas na tabela `nest_migrations`.
  - A baseline cria o schema das tabelas da aplicação (o mesmo que as migrations do Django produzem, sem as tabelas internas do Django: `django_*`, `auth_*` e M2M de grupos e permissões).
  - Em banco já criado pelo Django (`users_user` existe), a baseline não faz nada. Nenhum dado se perde.
- **Seed**: `npm run seed` carrega `backend-nest/seed/seed_data.json`, que tem o mesmo conteúdo e formato do fixture do Django, só se ainda não houver destinos.
- **Migração de dados**: `npm run fixtures:load -- <arquivo.json>` importa qualquer `manage.py dumpdata` dos modelos da aplicação, mapeando pelo metadata do TypeORM. O README documenta o passo a passo para trazer o `backend/db.sqlite3`.
- **docker-compose**: sai o serviço `migrate` (Django). A `api` roda migrations e seed na subida.
- **`scripts/dev.mjs`**: usa as migrations e o seed do Nest, sem `uv` e sem Django.
- **README e RODAR_LOCALMENTE**: o backend é o Nest. `backend/` fica documentado como legado, sem uso em execução.

## Parte D: testes e CI (#65, #66, #79)

- **e2e** (Jest + supertest) em `backend-nest/test/`. Sobem o `AppModule` contra o banco `viajero_test` (criado se faltar), rodam migrations e seed e cobrem:
  - auth, users, perfis, destinos, POIs e paginação/filtros;
  - roteiros (CRUD, geração com o gerador mock, edição de programa e desfazer);
  - favoritos, avaliações, links e auditoria;
  - IA e Firecrawl com dependências externas falsas.
- **CI**: `.github/workflows/ci.yml` com job do backend-nest (lint, build, unit, e2e com serviço Postgres 16) e job do front (lint, build, test).
- **Smoke**: `scripts/smoke-contract.mjs` ganha a edição de programa.
- **Docs**: `backend/MODULES.md` e `insomnia-viajero.json` passam a ter as rotas novas; `DESIGN_PATTERNS.md` registra o Memento.

## Critérios de pronto

- Build, lint, testes unitários e e2e do backend-nest passando; build, lint e testes do front passando.
- `docker compose down -v && docker compose up --build` em banco vazio sobe sem Django, com seed. O smoke passa.
- Editar o roteiro no navegador persiste após recarregar e desfazer funciona.
