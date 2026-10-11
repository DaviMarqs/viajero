# Conferência das referências visuais

Resultado: passed para a adaptação das telas existentes; não representa reprodução integral dos 16 frames.

Referências: 16 JPGs em `C:/Users/Felipe/Documents/Desktop`. Comparação visual conjunta de `Homepage.jpg` e `Explorar.jpg` com capturas reais da implementação.

Implementação: `http://localhost:5173/`. Capturas em `artifacts/design-qa/home.jpg`, `explorar.jpg` e `login.jpg`. Desktop observado a 1526 px de largura; responsividade conferida a 390 × 844 px e dimensão restaurada depois.

Verificado: painéis brancos arredondados, sidebar discreta, coleções de cards com tamanho compartilhado, formulário à esquerda/painel azul à direita no login, versão móvel em uma coluna, pesquisa de moeda por nome, abas dos dias com atualização da estimativa e seleção das miniaturas. Valores de transformação e dashoffset da hero mudaram entre observações, confirmando o GSAP em execução.

Diferenças intencionais: fotos, destinos, avaliações e valores vêm dos dados disponíveis. Ações de edição e favoritos permanecem visíveis. Quando não há roteiros públicos de outros usuários, recomendações mostram destinos reais. Categorias reais excedentes usam rolagem horizontal.

Limites: os frames de recuperação de senha e previsão meteorológica dependem de integrações que não existem no backend atual e não foram implementados. Cadastro e preferências receberam a composição compartilhada, mas não tiveram seus fluxos de gravação repetidos nesta rodada. Não há afirmação de fidelidade pixel a pixel.

Validação técnica: build TypeScript/Vite, ESLint e os 5 testes de fluxos do frontend passaram. Nenhuma alteração de backend nesta rodada.

## Ajustes posteriores: edição e hero

Edição passou a acontecer na página do roteiro, sem abrir a janela do editor. Horários e nomes podem ser alterados nos cards; remoção afeta o rascunho até salvar. Testados a troca de ordem pelas setas, arraste por teclado seguido de soltura, alteração de horário, remoção e cancelamento que restaura a lista original. A estimativa do dia acompanha atividades removidas. Campos ficam desabilitados durante o salvamento.

A hero usa agora camadas de gradiente azul, violeta e ciano vindas de baixo, animadas por GSAP, substituindo as linhas anteriores. Respeita redução de movimento e pausa fora da tela. Setas dos carrosséis têm fundo branco opaco, confirmado pelo estilo computado `rgb(255, 255, 255)`.

Conferência móvel a 390 × 844: controles se acomodam sem transbordamento horizontal. Captura `artifacts/design-qa/edicao-mobile.jpg`. Novo build e lint passaram; os 5 testes permanecem aprovados. As mudanças de programação continuam sendo armazenadas no navegador, conforme o comportamento existente.

## Parametrização por viagem e catálogo de destinos

Geração exige parâmetros completos desta viagem. O backend salva um snapshot no roteiro e no job, que não consulta mais as últimas preferências da conta ao executar. DNA permanece separado. Datas fixas são informadas pelo viajante; não há mais datas arbitrárias cinco dias no futuro. Preferências da conta continuam como valores iniciais para próximas viagens.

Aba Destinos adicionada à navegação, com pesquisa por cidade, país e experiência. Nomes conhecidos são apresentados em português, mantendo aliases em inglês e pesquisa sem acentos. Conferido no navegador: Japao encontra Tóquio e gerar a partir de Lisboa leva à parametrização obrigatória. Catálogo usa até 100 destinos já disponíveis; novos nomes precisam de aliases ou metadata.name_pt para localização específica.

Cards de Escolhas alinhadas ao DNA têm três colunas no desktop, fotos menores e tags reais normalizadas. Capturas: artifacts/design-qa/destinos.jpg e artifacts/design-qa/home-dna-compact.jpg.

Esta rodada substitui a edição manual dos nomes/horários citada acima: nomes e descrições de atividades vêm do backend; reordenar e excluir continua permitido. Ao salvar, horários são recalculados preservando duração de visitas e incluindo 30 minutos entre atividades. Conferido no navegador que não há campos editáveis de atividade; cancelamento preserva o roteiro. Persistência de programação permanece local no navegador. O backend ainda usa o gerador mock.

Validação: builds frontend/backend aprovados, 7 testes frontend e 43 testes backend aprovados. Casos novos cobrem aliases português/inglês, conservação de nomes, recálculo após reordenação/exclusão, parâmetros incompletos e snapshot independente.

## Hero com fotografia de destino

Esta proposta foi rejeitada posteriormente e substituída pela hero abstrata descrita abaixo.

Hero refinada com composição em duas colunas: título e ações à esquerda, fotografia de destino à direita. Mantém o texto original, acrescenta acesso a Destinos e permite abrir o destino pela imagem. O destaque vem do catálogo, priorizando opções com foto e tag Natureza; há fallback sem foto e skeleton durante carregamento.

Gradiente vindo de baixo e movimento lento da fotografia usam GSAP, com redução de movimento e pausa fora da tela/aba oculta. Referências de descoberta: https://www.airbnb.com/ e https://www.expedia.com/. Fotografia reutilizada do cadastro de destinos/seed_data.json (URL Unsplash), sem nova aquisição de imagem.

Conferência visual do componente real no desktop e em 390 × 844, sem transbordamento móvel. Transformações do gradiente variaram entre observações. A sessão autenticada expirou durante a revisão, então a inspeção usou uma página temporária do mesmo componente com dados do catálogo; os arquivos temporários foram removidos. Capturas: artifacts/design-qa/hero-viagem-desktop.png e artifacts/design-qa/hero-viagem-mobile.png. A versão é implementada, ainda não avaliada pelo usuário.

## Hero abstrata, sem destinos específicos

Removidos foto, legenda, link de destino específico e dependência do catálogo na hero. Conteúdo centralizado com título em duas linhas e hierarquia entre Criar novo roteiro e Explorar destinos. Gradiente azul/ciano/violeta vem de baixo e mantém movimento GSAP, redução de movimento e pausa fora da tela. CSS e animações da fotografia foram retirados.

Build e lint aprovados. Conferência do componente real em página temporária: desktop e 390 × 844, sem imagens na hero e sem transbordamento horizontal. Arquivos temporários removidos. Captura: artifacts/design-qa/hero-abstrata.png.
