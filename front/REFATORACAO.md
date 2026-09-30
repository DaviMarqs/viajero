# Refatoração do frontend Viajero

## Escopo e inspeção

Trabalho restrito a `front/`. O estado Git inicial estava limpo. Nenhum arquivo de `backend/`, `backend-nest/`, `docs/`, banco ou infraestrutura foi modificado. As dependências existentes foram restauradas com `npm ci`; nenhuma dependência foi acrescentada.

Inspecionados: README raiz, README Nest, configurações Vite/TypeScript/Tailwind, todas as rotas, primitives, hooks de perfil/autenticação, serviços HTTP, tipos de viagem, serializers/viewsets Django e controllers Nest relevantes. O build inicial passou; o lint inicial apresentou 44 erros, inclusive um hook condicional no detalhe de roteiro. Os erros de lint foram corrigidos sem desligar regras globalmente.

Ordem aplicada: contrato e navegação → tokens/primitives → Home/descoberta/detalhes → criação e acompanhamento → formulários e responsividade → validação visual e documentação.

## Rotas e referência visual

Arquivo: https://www.figma.com/design/ICoWCyoTKzciyBLoaMEXp7/Viajero---App?node-id=711-1090

| Rota preservada | Referência / comportamento |
| --- | --- |
| `/` | `793:9489`, Home: hero central, sidebar de 252 px, painéis de descoberta e roteiros |
| `/explorar` | `793:9568`, cards, categorias e superfícies; filtros reais ficam na URL |
| `/recomendações` | `793:9626` bloqueado pelo MCP; reutiliza descoberta com dados da API |
| `/destinos/:id` | `793:9640`, imagem principal, título, orçamento, informações e POIs |
| `/roteiros/criacao` | `807:4387` escolha de caminho; `807:4880` busca e seleção |
| `/roteiros` | Lista existente, com primitives e tokens comuns |
| `/roteiros/:id` | Detalhe existente, dias/eventos e acompanhamento de geração |
| `/onboard` | DNA do viajante; mantidos passos, valores e PATCH existentes |
| `/onboard/preferências` | Preferências; mantidos passos, valores e PATCH existentes |
| `/perfil` | Dados pessoais, DNA, edição e upload existentes |
| `/login`, `/register` | JWT existente; validação com labels, autocomplete e mensagens associadas |
| `/test` | Rota de demonstração preservada; não é um fluxo de produção |

O MCP identificou as páginas Desktop (`711:1090`) e Components (`15:173`). Foram recebidos e inspecionados código de alta fidelidade, screenshots e descrições das variantes de sidebar dos cinco frames acessíveis. Após isso, o plano Starter bloqueou Recomendações, metadata detalhada de Desktop/Components, variáveis completas e screenshot alternativo de Recomendações. Não se declara correspondência visual integral com os frames indisponíveis.

## Tokens e decisões visuais

`src/index.css` mantém Tailwind v4 com `@theme` e o plugin Vite existente. Valores recuperados do contexto Figma:

| Token | Valor / origem |
| --- | --- |
| Fundo | `#fafafa` |
| Superfície | `#ffffff` |
| Texto principal | `#0d0d0e` (`text/darker`) |
| Texto secundário | `#4b4b53` (`text/strong`), `#68686e` (`text/soft`) |
| Ação principal | `#1a58d4` (`blue/700`) |
| Azul de destaque / foco | `#177afb` (`blue/600`) |
| Superfície azul | `#e8f2ff` (`blue/100`) |
| Borda suave | `rgba(25,25,28,0.12)` |
| Borda de input | `#dde2ea` |
| Raio de card | 16 px |
| Tipografia | Geist para títulos; Inter para texto; texto de 14/16 px, títulos de 24/32/40/48 px conforme contexto |
| Sidebar / conteúdo | 252 px / padding de 24 px; seções com intervalo de 32 px |
| Sombra de card | `0 8px 24px -12px #071B4A12, 0 1px 3px #0B12200A` |

Escala de espaçamento usa a base existente do Tailwind (4 px) com 8/16/24/32 px como intervalos principais. Foco tem outline de 3 px; controles principais têm pelo menos 44 px de altura. Hover dura 150 ms; `prefers-reduced-motion` reduz animações/transições. Hover, erro e sucesso possuem tokens de implementação; esses valores não são apresentados como tokens auditados do Figma. Os valores exatos de cyan e coral permanecem pendentes da coleção Components/variables, bloqueada pelo MCP.

Geist já é distribuído pela dependência existente. Inter é carregada por Google Fonts com fallback `system-ui`; ambientes sem acesso externo usam o fallback. Imagens de destinos continuam vindo da API, com estado explícito quando ausentes ou quebradas. Não foram incorporadas fotos estáticas do Figma como se representassem destinos retornados pela API. Ícones reutilizam Lucide, já existente e também identificado nos frames.

## Arquitetura e padrões

Páginas e URLs permanecem em `pages/` e `App.tsx`. Rotas usam `React.lazy`/`Suspense`, reduzindo o JavaScript inicial. Não houve mudança geral de diretórios.

| Responsabilidade | Arquivos |
| --- | --- |
| Tokens e layout | `src/index.css`, `src/App.tsx` |
| Primitives compartilhadas | `components/ui/button`, `input`, `dialog`, `feedback`, `breadcrumbs`, `Sidebar` |
| Destinos | `features/destinations/destination-adapter.ts`, `destination-card.tsx` |
| Geração | `features/itineraries/generation-service.ts` |
| Estado assíncrono | `hooks/useAsyncResource.ts`, hooks de perfil/POIs/destinos/roteiros |
| Transporte e contratos | `lib/api.ts`, serviços existentes e `types/travel.ts` |

**Adapter:** `destination-adapter.ts` transforma os campos atuais/legados de imagem, tags, duração, avaliação e custo em dados de card. Distingue orçamento diário de total e não inventa duração, nota ou preço ausentes. O adaptador de listas existente em `api.ts` continua aceitando arrays e envelopes `data/results/items`; o cliente agora preserva os headers comuns mesmo quando o chamador passa headers próprios. `apiRequest<T>` retorna `T`, eliminando o `any` que escondia erros de tipagem.

**Facade:** `generation-service.ts` coordena o fluxo real de quatro etapas: criar, atualizar datas, gerar e acompanhar. A página trata seleção/feedback; o serviço concentra ordem das chamadas, timeout e cancelamento. O ID criado é exposto à página para permitir recuperação sem criar outro roteiro automaticamente.

Nenhuma classe adicional, singleton manual, sistema de eventos ou padrão artificial de Factory/Builder/Decorator foi introduzido. A ordenação tem quatro opções locais simples; funções comuns e React são suficientes. Roteiro/dia/evento seguem composição normal de JSX, sem replicar o Composite do backend.

## Conexão com o backend existente

Não havia listener em `8000`, `8001` ou `5173` no início, nem `.env` no frontend. A documentação raiz e `lib/api.ts` apontam Django em `http://localhost:8000`; esse padrão foi preservado. `VITE_API_URL` permite escolher explicitamente Nest em `8001`. Não há autodetecção, troca silenciosa de backend ou dados simulados em produção.

JWT continua em `viajero.access_token`/`viajero.refresh_token`, com `Authorization: Bearer ...`. Guards e persistência de autenticação foram preservados. `Accept: application/json` é enviado; JSON mantém `Content-Type: application/json`; `FormData` deixa o navegador definir seu boundary. Erros retêm status, payload e `errors` em `ApiError`; falha de rede é traduzida em mensagem acionável, sem simular sucesso.

| Fluxo | Endpoints existentes |
| --- | --- |
| Login/cadastro | `POST /api/auth/login/`, `POST /api/auth/register/` |
| Home/explorar/recomendações/destino | `GET /api/destinations/` |
| Busca/sugestão | `GET /api/destinations/search/?q=...`, `POST /api/destinations/suggest/` |
| Roteiros | `GET/POST /api/itineraries/`, `GET/PATCH /api/itineraries/:id/`, `POST /api/itineraries/:id/generate/` |
| Perfil | `GET/PATCH /api/users/me/`, upload existente em `/api/users/me/avatar/` |
| DNA/preferências | `GET/PATCH /api/traveler-dna/me/`, `GET/PATCH /api/trip-preferences/me/` |
| POIs | `GET /api/pois/`; detalhes também usam `destination.pois` |

Sucesso padrão é `{ success, message, data }`; listas podem vir paginadas dentro de `data`. Erro padrão é `{ success: false, message, errors }`, além de `detail` de DRF. A geração mantém exatamente `{ destination, title }`, PATCH de `start_date/end_date` e POST de geração sem payload. Datas continuam começando cinco dias após a criação, usando a duração retornada e fallback de cinco dias. O servidor Django lê as preferências do usuário ao criar o roteiro; o frontend não passa um ID de preferência novo no payload.

Limitações identificadas no servidor e preservadas:

- O controller Nest inspecionado não expõe `POST /api/destinations/suggest/`. A ação mostra o erro retornado; não troca de API nem simula sugestão.
- O endpoint de upload de avatar usado pelo frontend não foi encontrado nos controllers/viewsets inspecionados. A chamada foi preservada e a falha aparece na interface.
- O detalhe de destino ainda resolve ID/slug a partir da lista, como antes; destinos fora da página retornada podem não ser encontrados. Não foi alterado o endpoint desse fluxo.
- Listagens mantêm a paginação fornecida pelo serviço atual; filtros operam sobre os itens carregados, não sobre um catálogo completo garantido.
- Abortar acompanhamento não cancela um job no servidor. Em falha de rede após um POST, pode haver resultado ambíguo no servidor; a UI não repete a criação automaticamente.

## Usabilidade e acessibilidade

- Home distingue destinos e roteiros; recomendações deixam de repetir cards estáticos e não afirmam uma compatibilidade calculada que a listagem não fornece.
- Explorar preserva `q`, `categoria` e `ordem` na URL. Resultados vazios oferecem limpar filtros ou pesquisar; falhas oferecem nova tentativa.
- Criação tem escolha de caminho, busca, seleção explícita e confirmação. `auto=destino` continua válido e abre o caminho de sugestão; gerar um roteiro agora exige confirmação. O destino escolhido nos detalhes é passado por estado da navegação.
- Progresso e erros usam `role=status`/`alert`, skeletons, texto explicativo e ações de recuperação. O bloqueio síncrono evita POST duplicado durante geração.
- Menu mobile e confirmação de saída reutilizam Radix: foco contido, Escape e restauração de foco. Navegação tem nome acessível, `aria-current` e link para pular ao conteúdo.
- Inputs de login/cadastro e onboarding possuem associação de labels; mensagens de autenticação têm IDs/`aria-describedby`, `aria-invalid` e autocomplete. Controles de seleção usam `aria-pressed`.
- Formulários de perfil inicializam a edição a partir do valor atual quando a pessoa solicita editar, evitando sobrescrever alterações enquanto digita.
- Requests de perfil/POIs cancelam ao desmontar; resultados de uma identidade anterior não substituem dados atuais. Detalhe de roteiro usa polling sequencial apenas enquanto `generating`, sem intervalos concorrentes.
- Layout testado em 390, 768 e 1440 px. Filtros de POIs quebram linha; CTAs longos se adaptam ao mobile.

## Validação e evidências

`npm run dev -- --host 127.0.0.1` iniciou Vite em `http://127.0.0.1:5173`. O Chrome esperado pelos MCPs Playwright/Chrome DevTools não estava instalado, e Browser não tinha sessão disponível. Foi utilizado Playwright já presente no ambiente com Microsoft Edge existente; nenhuma ferramenta foi instalada. DevTools foi inspecionado pelo protocolo CDP (`Runtime` e `Network`) via Playwright.

`scripts/browser-check.mjs` executa fixtures **apenas no contexto isolado de testes**, sem backend, sem cadastro de usuários e sem seed na aplicação. Valida:

- 13 rotas × 3 viewports = 39 combinações, sem overflow horizontal nem exceções JavaScript;
- redirecionamento de rota protegida para login e validação obrigatória;
- preservação da busca ao voltar dos detalhes;
- Escape e retorno de foco no menu mobile;
- seleção → criação → PATCH → geração → detalhe, com um único POST de criação e payload/headers conferidos;
- carregamento, vazio, erro 503, erro de rede e recuperação por nova tentativa;
- emulação de movimento reduzido e verificação de textos sem corrupção de encoding.

`artifacts/browser-report.json` guarda resultados e requisições; `artifacts/fixture-{largura}-{índice}.png` guarda screenshots. Os índices seguem a ordem das rotas no script. Console/CDP não mostraram exceções ou erros inesperados; as únicas mensagens de erro foram 503 e conexão recusada dos testes de falha. Capturas de Home, exploração, seleção e detalhes foram inspecionadas visualmente. Os testes não comprovam login real, persistência, geração real por IA, CORS ou compatibilidade operacional com um servidor ativo.

Build e lint finais passam. O carregamento por rota reduziu o bundle inicial de aproximadamente 519 kB para 273 kB (valores sem gzip), sem o aviso de chunk acima de 500 kB.

Para reproduzir, com Vite iniciado e uma instalação existente de Playwright:

```powershell
$env:PLAYWRIGHT_MODULE = 'CAMINHO/para/playwright/index.mjs'
$env:BROWSER_CHANNEL = 'msedge'
node scripts/browser-check.mjs
```

## Diferenças restantes do Figma

Não é uma reprodução pixel a pixel. Components, tokens completos e Recomendações aguardam acesso ao MCP. Galeria com múltiplas fotos, favoritos e carrosséis do desenho não foram simulados quando o fluxo atual não oferece esses dados/rotas. Categorias são botões provenientes das tags reais, sem imagens ilustrativas arbitrárias. Recomendações reutiliza o catálogo e a sugestão já existente; não há ranking personalizado inventado. O fluxo de criação aproveita os frames de escolha/seleção, mantendo as telas existentes de onboarding em suas URLs. As áreas sem frame acessível recebem a base visual comum, sem atribuir ao Figma um layout não inspecionado.
