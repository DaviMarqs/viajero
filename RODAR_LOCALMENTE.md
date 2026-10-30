# Como rodar o Viajero localmente (do zero)

Guia para subir o projeto inteiro numa máquina nova: banco, API, front e o primeiro uso. Leva uns 15 minutos, a maior parte em downloads.

## Nesta máquina Windows

O ambiente local usa Node.js 24, Python 3.12 em `backend/.venv` e o serviço PostgreSQL 18 instalado no Windows. Os dois backends já estão configurados para o mesmo banco `viajero`; Docker não é necessário. As migrations e os quatro destinos iniciais foram conferidos.

Na raiz do projeto, execute:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar-local.ps1
```

O comando aplica migrations pendentes e inicia a API em `http://localhost:8001` e o front em `http://localhost:5173`, em segundo plano e com recarga automática. Serviços que já respondem são reutilizados. Os logs e os PIDs ficam em `.local/`, fora do Git. O script usa as portas locais padrão acima; se alterar as portas nos arquivos de ambiente, use os comandos manuais dos passos 5 e 6.

Para encerrar os servidores, use os PIDs atuais mostrados por `Get-NetTCPConnection -State Listen -LocalPort 8001,5173` e execute `Stop-Process -Id <PID>`. Para o Nest em modo watch, encerre também o processo supervisor cujo PID está em `.local/api.pid`.

O serviço PostgreSQL deve estar em execução. Não recarregue o seed em um banco com dados existentes; `loaddata` pode sobrescrever os registros iniciais.

> O front novo e o `backend-nest` estão na branch `new-front` até o merge. Depois de clonar, rode `git checkout new-front`.

## Jeito mais rápido: tudo no Docker

Com o Docker instalado, na raiz do repositório:

```bash
docker compose up --build
```

Esse comando sobe quatro serviços em ordem: o PostgreSQL (`viajero-pg`), o `migrate` (Django cria ou atualiza as tabelas e carrega o seed só se o banco estiver vazio, depois encerra), a API Nest (`http://localhost:8001`) e o front (`http://localhost:5173`). Não precisa de Node nem de `uv` na máquina. A primeira vez demora alguns minutos baixando as imagens.

- **IA:** antes de subir, crie o `backend-nest/.env` a partir do `backend-nest/.env.example` e preencha `GROQ_API_KEY` (passo 5). O Docker lê esse arquivo; sem ele tudo funciona com o gerador mock.
- **Depois de `git pull` ou de mudar código:** rode o mesmo comando. O `--build` refaz as imagens; não há recarga automática dentro do Docker. Para desenvolver, prefira o passo a passo abaixo.
- **Em segundo plano:** `docker compose up --build -d`. Logs: `docker compose logs -f api`. Parar: `docker compose down` (os dados continuam no volume `viajero-pgdata`).
- **Já tinha o container `viajero-pg` criado com `docker run`** (versões antigas deste guia)? Remova uma vez com `docker rm -f viajero-pg`; os dados ficam no volume e o compose usa o mesmo volume.
- **Porta 5432 ocupada** por um PostgreSQL da máquina? `DB_PORT=55432 docker compose up --build` (no PowerShell: `$env:DB_PORT="55432"; docker compose up --build`).

## Visão geral

```
Navegador ──► Front React/Vite (5173) ──► API NestJS (8001) ──► PostgreSQL (5432)
                                                                     ▲
                                  Django (backend/) cria as tabelas ─┘  (migrations + seed)
```

| Parte | Pasta | Porta | Para que serve |
|---|---|---|---|
| PostgreSQL 16 | Docker | 5432 | Banco único do projeto |
| Django + DRF | `backend/` | 8000 (opcional) | **Dono do schema**: cria as tabelas (migrations) e carrega os dados iniciais (seed). A API Django é legado |
| NestJS | `backend-nest/` | 8001 | API principal, usada pelo front. Inclui a IA (Groq/Gemini) e o Firecrawl |
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

> O `npm run start:dev` do passo 5 já faz este passo e o 4 sozinho quando o banco não responde. Eles ficam aqui para quem quer subir à mão.

```bash
docker compose up -d db
```

Usuário `postgres`, senha `1414` e banco `viajero` são os valores que os `.env.example` dos dois backends já usam, então não precisa mudar nada. O volume `viajero-pgdata` guarda os dados mesmo se o container for recriado.

Conferir se o banco está pronto (deve responder `accepting connections`):

```bash
docker exec viajero-pg pg_isready -U postgres -d viajero
```

- **Container `viajero-pg` antigo, criado com `docker run`?** Rode `docker start viajero-pg`, ou remova com `docker rm -f viajero-pg` (os dados ficam no volume) para usar o compose.
- **Porta 5432 ocupada** (PostgreSQL instalado na máquina)? Rode `DB_PORT=55432 docker compose up -d db` e ajuste o `DATABASE_URL` nos dois `.env` (passos 4 e 5) para `postgresql://postgres:1414@localhost:55432/viajero`.
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
- As chaves de IA do `backend/.env` não são usadas pelo app: a IA roda no Nest, que lê as chaves do próprio `backend-nest/.env` (passo 5).
- Opcional: `uv run manage.py createsuperuser` cria um admin (Django admin em `http://127.0.0.1:8000/admin` e acesso a `GET /api/audit-logs`).

## 5. API NestJS

```bash
cd ../backend-nest
npm ci
cp .env.example .env
npm run start:dev
```

### Chaves de IA (recomendado)

No `backend-nest/.env`, preencha pelo menos a `GROQ_API_KEY` (gratuita em https://console.groq.com/keys). Com ela, o Nest:

- gera o roteiro com IA, em português, com horários e custos dentro do orçamento da viagem;
- reconhece o destino digitado (ex.: "formiga" vira Formiga, MG; "asdfgh" é recusado com aviso);
- descobre destinos que não estão no banco (resumo, melhor época, pontos de interesse, custos e foto da Wikipedia);
- sugere um destino pelo DNA do viajante ("Gostaria de uma sugestão").

Opcionais: `GEMINI_API_KEY` (reserva do Groq, ou provedor principal com `DEFAULT_LLM_PROVIDER=gemini`) e `FIRECRAWL_API_KEY` (dados de guias turísticos na descoberta de destinos). Sem nenhuma chave o app continua funcionando: o roteiro sai do gerador determinístico (textos em inglês) e a busca cria um destino básico. Cada dev usa a própria chave, e chave nunca vai para o git. Reinicie o Nest depois de mudar o `.env`.

O `start:dev` confere tudo antes de subir a API:

1. se o PostgreSQL do `DATABASE_URL` não responde, sobe o banco do `docker-compose.yml` (container `viajero-pg`); com PostgreSQL instalado na máquina e respondendo, o Docker não é usado;
2. aplica as migrations do Django (via `uv`) e carrega o seed se o banco estiver vazio;
3. inicia o Nest com recarga automática.

O banco continua ligado depois que você para a API. `npm run start:watch` sobe só o Nest, sem essas conferências.

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

### Fluxos atualizados da interface

- A Home reúne Meus roteiros e Roteiros para você lado a lado no desktop, com destinos recomendados abaixo. Recomendações usam interesses do DNA e tags dos pontos de interesse; não há conteúdo fictício para preencher listas vazias.
- Explorar mostra escolhas por DNA e outros destinos. Categorias vêm das tags do banco, incluindo Praia e Natureza quando presentes.
- O detalhe do destino apresenta orçamento econômico/intermediário/alto, informações gerais, imagens e dados dos pontos de interesse. Gerar roteiro abre a configuração da viagem, seguida de uma sugestão automática de destino. A revisão permite ajustar parâmetros ou pedir outra sugestão.
- Favoritos está na navegação. Destinos favoritos são salvos por conta no armazenamento deste navegador; roteiros favoritos usam a API existente.
- Perfil → Moeda de exibição salva `preferred_currency` na API. Valores de destinos e roteiros são convertidos aproximadamente com taxas do Frankfurter (`https://frankfurter.dev/`). A cotação consultada aparece na interface. Sem cotação, permanece o valor na moeda original; o orçamento de origem não é alterado.
- Editar roteiro salva nome, resumo e datas na API. Edição, remoção e reordenação de atividades são salvas por conta e roteiro neste navegador, pois a API ainda não oferece mutação de eventos. Arrastar, teclado (espaço/setas/espaço) e botões de subir/descer são suportados. Reordenar não altera horários; as estimativas originais são preservadas.
- No detalhe do roteiro, "Gerar novamente" pede uma nova programação à IA, com confirmação. O nome escolhido pelo usuário e as datas são mantidos; as edições de atividades salvas no navegador são descartadas. Se a geração falhar, a programação anterior continua valendo.
- O formulário de avaliação da viagem do proprietário aparece após o fim da data de volta. Avaliações usam a API existente. Confirmações são diálogos renderizados com controle de foco.
- As microinterações usam CSS e respeitam redução de movimento; a reordenação usa dnd-kit. GSAP não é necessária para estes efeitos.

Em `front/`, `npm test` cobre câmbio, personalização, persistência da programação e liberação da avaliação. Esse comando usa o suporte nativo a TypeScript do Node 22.18+ (nesta máquina, Node 24).

1. **Cadastro:** "Criar uma conta nova" (senha com pelo menos 8 caracteres).
2. **Perfil de viajante:** responda o onboarding e conclua.
3. **Criar roteiro:** na Home, "Criar novo roteiro" → preencha orçamento, companhia, período, hospedagem, deslocamento, cuidados e interesses → "Sugerir meu destino" → revise o destino sugerido e os parâmetros → "Confirmar e gerar roteiro". Não há escolha inicial entre busca e sugestão. Os parâmetros desta viagem seguem para a sugestão e para o prompt de geração; o DNA permanente continua no perfil.
4. **Avaliar:** no detalhe do roteiro, "Avaliar roteiro" → escolha a nota → "Publicar avaliação". O roteiro passa a aparecer em "Roteiros mais bem avaliados" na Home.
5. **Perfil:** em "Perfil", edite o nome e troque a foto. A barra lateral atualiza na hora.

O que é esperado, e não é bug:

- Com a chave do Groq, gerar um roteiro leva de 5 a 15 segundos. Sem chave, o roteiro sai do gerador determinístico, com textos em inglês ("Day 1: Lisbon").
- Buscar um destino que não está no banco leva de 20 a 40 segundos na primeira vez (IA + Firecrawl); depois ele fica salvo e aparece na hora. Sem chaves, a busca cria um destino básico (país "Desconhecido", sem pontos de interesse).
- Os destinos do seed estão em inglês no banco ("Lisbon"), mas a busca e a interface aceitam o nome em português ("Lisboa").
- O plano gratuito do Groq limita os tokens por minuto. Gerar vários roteiros seguidos pode devolver "O servico de IA atingiu o limite de uso"; espere um minuto e tente de novo.
- A sessão dura 60 minutos (`JWT_ACCESS_MINUTES`). Depois disso o app volta para o login com o aviso "Sua sessão expirou".

## 8. Dia a dia

Ordem para subir tudo:

```bash
cd backend-nest && npm run start:dev    # terminal 1: liga o banco se precisar e sobe a API
cd front && npm run dev                 # terminal 2
```

Ou tudo no Docker: `docker compose up --build` na raiz.

Depois de um `git pull`:

- Mudou `package-lock.json`? Rode `npm ci` na pasta correspondente (`backend-nest/` ou `front/`).
- Mudou alguma migration do Django (`backend/apps/*/migrations/`)? O `npm run start:dev` (e o `docker compose up`) aplica sozinho.
- Mudou `backend/pyproject.toml` ou `backend/uv.lock`? Rode `cd backend && uv sync`.

## 9. Testes e verificação

| Onde | Comando | O que verifica |
|---|---|---|
| `backend-nest/` | `npm test` | Testes unitários (Jest) |
| `backend-nest/` | `npm run lint` e `npm run build` | Lint e compilação |
| `front/` | `npm run lint` e `npm run build` | Lint, tipos e build de produção |
| `backend-nest/` | `npm run smoke` | Contrato HTTP usado pelo front, ponta a ponta (cadastro, perfil, avatar, roteiros, avaliações), com a API rodando |

Com chave de IA no `.env`, o `smoke` chama a IA de verdade (gasta cota e leva cerca de 1 minuto). O `smoke` **grava dados** a cada execução: usuários `smoke-*@viajero.dev`, roteiros e avaliações. Para não sujar o seu banco, rode contra um banco descartável:

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

## 10. (Opcional) API Django legada

Todos os recursos, inclusive a IA, estão no NestJS. A coleção do Insomnia (`insomnia-viajero.json`) usa `base_url = http://localhost:8001`. O Django continua sendo o dono do schema (passo 4), mas a API dele não é mais necessária:

```bash
cd backend
uv run manage.py runserver
```

O modelo padrão do Groq no Django (`llama-3.3-70b-versatile`) foi removido pelo Groq; a IA do Django só volta a funcionar trocando `GROQ_MODEL` no `backend/.env`. O front é mantido contra o NestJS; não aponte o front para a API Django.

Destinos sem foto podem ser completados pela Wikipedia com `npm run backfill:hero-images` dentro de `backend-nest/` (equivalente ao `backfill_hero_images` do Django; `--force` sobrescreve todos, `--limit N` limita).

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
| Roteiro com textos em inglês ("Day 1: ...") | Nest sem chave de IA | Preencha `GROQ_API_KEY` em `backend-nest/.env` e reinicie o Nest |
| Roteiro gerado sem atividades | Sem chave de IA, destino criado pela busca sem pontos de interesse | Configure a chave de IA ou use os destinos do seed (passo 7) |
| "O servico de IA atingiu o limite de uso" | Limite de tokens por minuto do plano gratuito do Groq | Espere um minuto e gere de novo |

Mais detalhes de cada parte: `backend-nest/README.md` (endpoints, convivência com o schema do Django, uploads) e `front/README.md`.
