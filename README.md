# Viajero

O Viajero é um projeto criado do zero (_greenfield_) com um backend em Django para a geração de itinerários de viagem assistida por IA.

## O que foi implementado

- **Apps modulares de domínio no Django:** Inclui utilizadores, destinos, perfis, itinerários, trabalhos (_jobs_) de LLM, registos de auditoria e ingestão via Firecrawl.
- **Autenticação JWT:** Endpoints de login e registo configurados com `djangorestframework-simplejwt`.
- **Serviço de geração de itinerários:** Inclui um gerador determinístico simulado (_mock_) para quando não há uma chave de LLM real configurada.
- **Serviço de ingestão Firecrawl:** Sistema de segurança com _fallback_ simulado quando a `FIRECRAWL_API_KEY` não está presente.
- **Aplicação React:** Composta por 12 ecrãs ao nível de rota, abrangendo descoberta, autenticação, integração (_onboarding_), geração, revisão de itinerários, favoritos e fluxo de administração do Firecrawl.

## Como rodar localmente (do zero)

O passo a passo completo (pré-requisitos, banco, API, front, primeiro uso, testes e problemas comuns) está em **[RODAR_LOCALMENTE.md](./RODAR_LOCALMENTE.md)**.

**Tudo no Docker (um comando, na raiz):**

```bash
docker compose up --build    # app em http://localhost:5173, API em http://localhost:8001
```

Sobe o PostgreSQL, cria as tabelas e o seed (Django), a API Nest e o front. Para a IA, crie antes o `backend-nest/.env` a partir do `.env.example` e preencha `GROQ_API_KEY`.

**Para desenvolver (recarga automática)**, com Docker, Node 20.19+ e `uv` instalados:

```bash
cd backend-nest && npm ci && cp .env.example .env && npm run start:dev   # liga o banco, aplica migrations/seed e sobe a API
cd front && npm ci && npm run dev                                           # outro terminal; app em http://localhost:5173
```

| Pasta | O que é |
|---|---|
| `backend/` | Django + DRF: dono do schema (migrations e seed). A API Django é legado |
| `backend-nest/` | API principal (NestJS) usada pelo front, com a IA: roteiros com Groq/Gemini, descoberta de destinos com Firecrawl e sugestão por perfil |
| `front/` | React + Vite |

## Notas

- **Evolução sem IA:** [proposta de enriquecimento de destinos e planejamento de roteiros com dados abertos](<./docs/Plano para enriquecimento da IA.md>), com fontes, preços verificáveis, proximidade e plano incremental. Documento de proposta, ainda não implementado.
- **IA:** preencha `GROQ_API_KEY` (e, se quiser, `GEMINI_API_KEY` e `FIRECRAWL_API_KEY`) em `backend-nest/.env`. Sem chaves o app funciona com gerador determinístico. Detalhes em [backend-nest/README.md](./backend-nest/README.md#ia).
- **Migrações:** rode `uv run manage.py makemigrations` apenas se você alterar modelos.
