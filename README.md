# Viajero

O Viajero é um projeto criado do zero (_greenfield_) para a geração de itinerários de viagem assistida por IA. O backend é em NestJS; ele nasceu em Django, que continua no repositório só como legado.

## O que foi implementado

- **Módulos de domínio no NestJS:** Inclui utilizadores, destinos, perfis, itinerários, trabalhos (_jobs_) de LLM, registos de auditoria e ingestão via Firecrawl.
- **Schema próprio:** migrations TypeORM, seed e importação dos dados antigos do Django (`npm run fixtures:load`).
- **Autenticação JWT:** Endpoints de login e registo com Passport e `@nestjs/jwt`.
- **Serviço de geração de itinerários:** Inclui um gerador determinístico simulado (_mock_) para quando não há uma chave de LLM real configurada.
- **Serviço de ingestão Firecrawl:** Sistema de segurança com _fallback_ simulado quando a `FIRECRAWL_API_KEY` não está presente.
- **Aplicação React:** Composta por 12 ecrãs ao nível de rota, abrangendo descoberta, autenticação, integração (_onboarding_), geração, revisão de itinerários, favoritos e fluxo de administração do Firecrawl.

## Como rodar localmente (do zero)

O passo a passo completo (pré-requisitos, banco, API, front, primeiro uso, testes e problemas comuns) está em **[RODAR_LOCALMENTE.md](./RODAR_LOCALMENTE.md)**.

**Tudo no Docker (um comando, na raiz):**

```bash
docker compose up --build    # app em http://localhost:5173, API em http://localhost:8001
```

Sobe o PostgreSQL, a API Nest (que cria as tabelas pelas migrations e carrega o seed num banco sem destinos) e o front. Para a IA, crie antes o `backend-nest/.env` a partir do `.env.example` e preencha `GROQ_API_KEY`.

**Para desenvolver (recarga automática)**, com Docker e Node 20.19+ instalados:

```bash
cd backend-nest && npm ci && cp .env.example .env && npm run start:dev   # liga o banco, aplica migrations/seed e sobe a API
cd front && npm ci && npm run dev                                           # outro terminal; app em http://localhost:5173
```

| Pasta | O que é |
|---|---|
| `backend/` | Django + DRF: **legado**, não é usado para rodar. Serve de referência e para exportar dados antigos (`dumpdata`) |
| `backend-nest/` | API (NestJS) usada pelo front e dona do schema (migrations e seed), com a IA: roteiros com Groq/Gemini, descoberta de destinos com Firecrawl e sugestão por perfil |
| `front/` | React + Vite |

## Notas

- **IA:** preencha `GROQ_API_KEY` (e, se quiser, `GEMINI_API_KEY` e `FIRECRAWL_API_KEY`) em `backend-nest/.env`. Sem chaves o app funciona com gerador determinístico. Detalhes em [backend-nest/README.md](./backend-nest/README.md#ia).
- **Migrações:** o schema é do Nest (`backend-nest/src/database/migrations`). Mudou uma entity? Crie uma migration com `npm run migration:create` e escreva o SQL. Detalhes e importação do SQLite antigo em [backend-nest/README.md](./backend-nest/README.md#banco-migrations-seed-e-dados-antigos).
