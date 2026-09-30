# Viajero frontend

React 19, TypeScript 6, Vite 8 e Tailwind CSS v4. Radix, CVA e Lucide compõem a base de interface existente.

## Executar

```powershell
npm ci
npm run dev
```

Vite abre em http://localhost:5173. Configure a API em um arquivo `.env.local`, usando `.env.example` como referência:

```dotenv
VITE_API_URL=http://localhost:8001
```

O padrão é o NestJS em `http://localhost:8001`. Reinicie Vite após alterar a variável. O frontend não inicia nem modifica o backend. Veja o [guia local](../RODAR_LOCALMENTE.md) para iniciar todos os serviços e aplicar migrations.

## Verificar

```powershell
npm run build
npm run lint
```

O teste de navegador `scripts/browser-check.mjs` usa uma instalação existente de Playwright indicada por `PLAYWRIGHT_MODULE` e Edge por padrão. Ele gera fixtures isoladas e screenshots em `artifacts/`; não valida um servidor real nem inclui mocks no aplicativo.

Consulte [REFATORACAO.md](./REFATORACAO.md) para mapa de rotas/Figma, contratos preservados, decisões de arquitetura, padrões Adapter/Facade, acessibilidade, resultados e limitações.
