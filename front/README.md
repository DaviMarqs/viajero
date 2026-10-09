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
