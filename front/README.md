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

## Validar sem backend (mock temporário)

No PowerShell, dentro de `front`:

```powershell
$env:VITE_MOCK_API='true'
npm run dev
```

Entre com qualquer email válido e senha não vazia. O login abre um perfil de demonstração; o cadastro inicia o onboarding. O mock cobre destinos, busca/sugestão, pontos de interesse, perfil/avatar, DNA, preferências e criação/geração de roteiros com dias e atividades. As alterações ficam no `localStorage` deste navegador. A senha não é armazenada. Há uma latência simulada para verificar carregamentos.

Para testar listas vazias ou erros, execute no console do navegador e recarregue:

```js
localStorage.setItem('viajero.mock.scenario', 'empty') // ou 'error', ou 'success'
```

Para reiniciar os dados, remova `viajero.mock.data.v1` e recarregue. Para voltar ao backend, saia da conta simulada, pare o Vite e execute `Remove-Item Env:VITE_MOCK_API`, depois `npm run dev`. Caso tenha configurado a variável em `.env.local`, remova-a também.

Todo o mock está em `src/mock-backend.ts`: basta apagar esse arquivo após validar. O carregamento opcional em `src/main.tsx` tolera a ausência dele. O mock só é carregado em desenvolvimento e não entra no build de produção. Você pode apagar também o bloco opcional de `bootstrap` se quiser remover o suporte por completo.

## Verificar

```powershell
npm run build
npm run lint
```

O teste de navegador `scripts/browser-check.mjs` usa uma instalação existente de Playwright indicada por `PLAYWRIGHT_MODULE` e Edge por padrão. Ele gera fixtures isoladas e screenshots em `artifacts/`; não valida um servidor real nem inclui mocks no aplicativo.

Consulte [REFATORACAO.md](./REFATORACAO.md) para mapa de rotas/Figma, contratos preservados, decisões de arquitetura, padrões Adapter/Facade, acessibilidade, resultados e limitações.
