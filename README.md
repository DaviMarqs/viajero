# Viajero

O Viajero é um projeto criado do zero (_greenfield_) com um backend em Django para a geração de itinerários de viagem assistida por IA.

## O que foi implementado

- **Apps modulares de domínio no Django:** Inclui utilizadores, destinos, perfis, itinerários, trabalhos (_jobs_) de LLM, registos de auditoria e ingestão via Firecrawl.
- **Autenticação JWT:** Endpoints de login e registo configurados com `djangorestframework-simplejwt`.
- **Serviço de geração de itinerários:** Inclui um gerador determinístico simulado (_mock_) para quando não há uma chave de LLM real configurada.
- **Serviço de ingestão Firecrawl:** Sistema de segurança com _fallback_ simulado quando a `FIRECRAWL_API_KEY` não está presente.
- **Aplicação React:** Composta por 12 ecrãs ao nível de rota, abrangendo descoberta, autenticação, integração (_onboarding_), geração, revisão de itinerários, favoritos e fluxo de administração do Firecrawl.

## Como rodar localmente (do zero)

1. **Instale as ferramentas basicas**
   - Git
   - `uv` (instala o Python e gerencia dependencias)

   Linux/macOS:

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   Windows (PowerShell):

   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

   Depois, feche e abra o terminal para o `uv` entrar no PATH.

2. **Clone o repositorio**

   ```bash
   git clone https://github.com/DaviMarqs/viajero.git
   cd viajero
   ```

3. **Configure o backend (SQLite)**

   ```bash
   cd backend
   uv python install 3.12
   uv sync
   ```

4. **Crie o arquivo de ambiente**
   Crie o arquivo `backend/.env` com o basico para SQLite:

   ```dotenv
   DJANGO_SECRET_KEY=troque-isto
   DATABASE_URL=sqlite:///./db.sqlite3
   DEBUG=true
   ALLOWED_HOSTS=*
   CORS_ALLOW_ALL_ORIGINS=true
   JWT_SECRET_KEY=troque-isto
   DEFAULT_LLM_PROVIDER=mock
   DEFAULT_LLM_MODEL=mock-itinerary-v1
   ```

5. **Crie o banco e rode o servidor**

   ```bash
   uv run manage.py migrate
   uv run manage.py loaddata seed_data.json
   uv run manage.py loaddata seed_data_complete.json
   uv run manage.py runserver
   ```

   A API fica disponivel em http://127.0.0.1:8000

## Notas

- **Variaveis de ambiente completas:** `FIRECRAWL_API_KEY`, `FIRECRAWL_API_URL`, `DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`, `LLM_API_KEY`, `CORS_ALLOWED_ORIGINS`.
- **Migracoes:** Rode `uv run manage.py makemigrations` apenas se voce alterar modelos.
- **Provedor de LLM:** Substitua o gerador simulado em `backend/apps/ai/services.py` por um adaptador real assim que o provedor for escolhido.
