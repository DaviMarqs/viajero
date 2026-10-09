# Como rodar o Viajero localmente (do zero)

Guia para subir o projeto inteiro numa máquina nova: banco, API, front e o primeiro uso. Leva uns 15 minutos, a maior parte em downloads.

> O front novo e o `backend-nest` estão na branch `new-front` até o merge. Depois de clonar, rode `git checkout new-front`.

## Visão geral

```
Navegador ──► Front React/Vite (5173) ──► API NestJS (8001) ──► PostgreSQL (5432)
                                                                     ▲
                                  Django (backend/) cria as tabelas ─┘  (migrations + seed)
```

| Parte | Pasta | Porta | Para que serve |
|---|---|---|---|
| PostgreSQL 16 | Docker | 5432 | Banco único do projeto |
| Django + DRF | `backend/` | 8000 (opcional) | **Dono do schema**: cria as tabelas (migrations) e carrega os dados iniciais (seed). Também tem a API antiga com IA real (Gemini, Groq, Firecrawl) |
| NestJS | `backend-nest/` | 8001 | API que o front usa |
| React + Vite | `front/` | 5173 | Interface |

O NestJS **não cria tabelas**. Sempre aplique as migrations do Django antes de subir o Nest.

## 1. Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Git | qualquer recente | |
| Docker | Docker Desktop no Windows/macOS | Para o PostgreSQL. Dá para usar um PostgreSQL 16 instalado na máquina (veja o passo 3) |
| Node.js | **20.19+ ou 22.12+** | Exigência do Vite 8. Vem com o npm 10+ |
| uv | qualquer recente | Gerencia o Python; instala o Python 3.12 sozinho |

Instalar o `uv`:

```bash
# Linux/macOS
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Feche e abra o terminal depois de instalar. Conferir tudo:

```bash
git --version
docker --version
node --version
npm --version
uv --version
```

## 2. Clonar o repositório

```bash
git clone https://github.com/DaviMarqs/viajero.git
cd viajero
git checkout new-front
```

## 3. Banco de dados (PostgreSQL no Docker)

```bash
docker run -d --name viajero-pg -e POSTGRES_PASSWORD=1414 -e POSTGRES_DB=viajero -p 5432:5432 -v viajero-pgdata:/var/lib/postgresql/data postgres:16
```

Usuário `postgres`, senha `1414` e banco `viajero` são os valores que os `.env.example` dos dois backends já usam, então não precisa mudar nada. O volume `viajero-pgdata` guarda os dados mesmo se o container for recriado.

Conferir se o banco está pronto (deve responder `accepting connections`):

```bash
docker exec viajero-pg pg_isready -U postgres -d viajero
```

- **Container `viajero-pg` já existe?** Rode só `docker start viajero-pg`.
- **Porta 5432 ocupada** (PostgreSQL instalado na máquina)? Troque para `-p 55432:5432` e ajuste o `DATABASE_URL` nos dois `.env` (passos 4 e 5) para `postgresql://postgres:1414@localhost:55432/viajero`.
- **Sem Docker?** Crie o banco `viajero` no seu PostgreSQL 16 e ajuste usuário/senha no `DATABASE_URL` dos dois `.env`.

## 4. Tabelas e dados iniciais (Django)

```bash
cd backend
uv python install 3.12
uv sync
cp .env.example .env
uv run manage.py migrate
uv run manage.py loaddata seed_data.json
```

No Windows (PowerShell), troque `cp .env.example .env` por `Copy-Item .env.example .env`.

- O `loaddata` deve terminar com `Installed 32 object(s) from 1 fixture(s)`: 4 destinos (Lisbon, Tokyo, Rio de Janeiro e Buenos Aires), 16 pontos de interesse, tags e custos. O seed não cria usuários; o cadastro é feito pelo app.
- As chaves de IA do `.env` (Gemini, Groq, Firecrawl) **não são necessárias** para rodar o app: o Nest gera roteiros sem IA externa. Elas só servem para a API Django (passo 10). Cada dev usa a própria chave, e chave nunca vai para o git.
- Opcional: `uv run manage.py createsuperuser` cria um admin (Django admin em `http://127.0.0.1:8000/admin` e acesso a `GET /api/audit-logs`).

## 5. API NestJS

```bash
cd ../backend-nest
npm ci
cp .env.example .env
npm run start:dev
```

Pronto quando o terminal mostrar `Nest application successfully started`. A API fica em `http://localhost:8001`. Deixe esse terminal aberto.

Teste rápido (deve devolver os 4 destinos do seed): abra `http://localhost:8001/api/destinations/` no navegador, ou rode `curl http://localhost:8001/api/destinations/`.

As fotos de perfil enviadas pelo app ficam em `backend-nest/uploads/` (fora do git).

## 6. Front

Em outro terminal, a partir da raiz do repositório:

```bash
cd front
npm ci
npm run dev
```

Abra `http://localhost:5173`. O front já aponta para `http://localhost:8001`. Só crie `front/.env.local` se a API estiver em outra porta (use `front/.env.example` como modelo) e reinicie o Vite depois.

## 7. Primeiro uso (roteiro de teste)

1. **Cadastro:** "Criar uma conta nova" (senha com pelo menos 8 caracteres).
2. **Perfil de viajante:** responda o onboarding e conclua.
3. **Criar roteiro:** na Home, "Criar novo roteiro" → preencha as preferências → "Já sei para onde vou viajar" → escolha um destino da lista (ex.: Lisbon) → "Gerar roteiro para este destino".
4. **Avaliar:** no detalhe do roteiro, "Avaliar roteiro" → escolha a nota → "Publicar avaliação". O roteiro passa a aparecer em "Roteiros mais bem avaliados" na Home.
5. **Perfil:** em "Perfil", edite o nome e troque a foto. A barra lateral atualiza na hora.

O que é esperado, e não é bug:

- O roteiro gerado pelo Nest é determinístico e tem textos em inglês ("Day 1: Lisbon"). A geração com IA real só existe na API Django.
- Os destinos do seed estão em inglês. Buscar um nome que não existe no banco (ex.: "Lisboa") cria um destino básico (país "Desconhecido", sem pontos de interesse), e o roteiro dele sai sem atividades.
- A sessão dura 60 minutos (`JWT_ACCESS_MINUTES`). Depois disso o app volta para o login com o aviso "Sua sessão expirou".

## 8. Dia a dia

Ordem para subir tudo:

```bash
docker start viajero-pg
cd backend-nest && npm run start:dev    # terminal 1
cd front && npm run dev                 # terminal 2
```

Depois de um `git pull`:

- Mudou `package-lock.json`? Rode `npm ci` na pasta correspondente (`backend-nest/` ou `front/`).
- Mudou alguma migration do Django (`backend/apps/*/migrations/`)? Rode `cd backend && uv run manage.py migrate`.
- Mudou `backend/pyproject.toml` ou `backend/uv.lock`? Rode `cd backend && uv sync`.

## 9. Testes e verificação

| Onde | Comando | O que verifica |
|---|---|---|
| `backend-nest/` | `npm test` | Testes unitários (Jest) |
| `backend-nest/` | `npm run lint` e `npm run build` | Lint e compilação |
| `front/` | `npm run lint` e `npm run build` | Lint, tipos e build de produção |
| `backend-nest/` | `npm run smoke` | Contrato HTTP usado pelo front, ponta a ponta (cadastro, perfil, avatar, roteiros, avaliações), com a API rodando |

O `smoke` **grava dados** a cada execução: usuários `smoke-*@viajero.dev`, roteiros e avaliações. Para não sujar o seu banco, rode contra um banco descartável:

```bash
# banco temporário na porta 55432
docker run -d --name viajero-smoke -e POSTGRES_PASSWORD=1414 -e POSTGRES_DB=viajero -p 55432:5432 postgres:16

# tabelas + seed (dentro de backend/)
DATABASE_URL=postgresql://postgres:1414@localhost:55432/viajero uv run manage.py migrate
DATABASE_URL=postgresql://postgres:1414@localhost:55432/viajero uv run manage.py loaddata seed_data.json

# API apontando para ele, na porta 8002 (dentro de backend-nest/)
DATABASE_URL=postgresql://postgres:1414@localhost:55432/viajero PORT=8002 npm run start:dev

# em outro terminal (dentro de backend-nest/)
BASE_URL=http://localhost:8002 npm run smoke

# no fim
docker rm -f viajero-smoke
```

No PowerShell, defina as variáveis antes do comando: `$env:DATABASE_URL="postgresql://postgres:1414@localhost:55432/viajero"; $env:PORT="8002"; npm run start:dev`.

O resultado esperado termina com `Smoke OK`.

## 10. (Opcional) API Django com IA real

A API Django continua disponível para os recursos de IA (geração com Gemini/Groq e descoberta de destinos com Firecrawl) e para a coleção do Insomnia (`insomnia-viajero.json`, que usa `base_url = http://127.0.0.1:8000`).

```bash
cd backend
uv run manage.py runserver
```

Para usar IA real, preencha no `backend/.env` a sua chave (`GEMINI_API_KEY` ou `GROQ_API_KEY`) e troque `DEFAULT_LLM_PROVIDER`. O front é mantido contra o NestJS; não aponte o front para a API Django.

## 11. Zerar o banco (apaga tudo)

> **Atenção:** os comandos abaixo apagam permanentemente todos os dados locais (usuários, roteiros, avaliações). Não dá para desfazer.

```bash
docker rm -f viajero-pg
docker volume rm viajero-pgdata
```

Depois repita os passos 3 e 4. Para apagar também as fotos de perfil enviadas, remova a pasta `backend-nest/uploads/`.

## 12. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `connect ECONNREFUSED 127.0.0.1:5432` no Nest, ou `connection refused` no `migrate` | Banco parado | `docker start viajero-pg` |
| `relation "users_user" does not exist` | Migrations não aplicadas | Passo 4 (`uv run manage.py migrate`) |
| `port is already allocated` no `docker run` | Outro PostgreSQL usando a 5432 | Use `-p 55432:5432` e ajuste o `DATABASE_URL` nos dois `.env` |
| `EADDRINUSE: address already in use :::8001` | Outra instância da API rodando | Feche a outra instância, ou mude `PORT` em `backend-nest/.env` e `VITE_API_URL` em `front/.env.local` |
| Front mostra "Não foi possível conectar ao serviço" | API parada ou URL errada | Confira o terminal do Nest e o `VITE_API_URL`; reinicie o Vite após mudar o `.env.local` |
| Volta para o login com "Sua sessão expirou" | Token expirou (60 min) | Entre de novo. Para sessões mais longas em dev, aumente `JWT_ACCESS_MINUTES` em `backend-nest/.env` |
| `uv: command not found` | Terminal aberto antes da instalação | Feche e abra o terminal |
| Vite reclama da versão do Node | Node antigo | Instale o Node 20.19+ ou 22.12+ |
| Roteiro gerado sem atividades | Destino criado pela busca, sem pontos de interesse | Use os destinos do seed (passo 7) |

Mais detalhes de cada parte: `backend-nest/README.md` (endpoints, convivência com o schema do Django, uploads) e `front/README.md`.
