# Ideias e problemas do Viajero

Registro de produto — 10/10/2026. Os itens abaixo são propostas e questões em aberto, não funcionalidades concluídas.

## Hero: visual ainda não aprovado

O usuário não gostou da hero atual, mesmo após substituir as linhas pelo gradiente animado com GSAP. A direção desejada continua sendo um gradiente vindo de baixo, com movimento sutil e aparência de produto com IA.

Próximo passo: explorar referências e propostas visuais antes de outra implementação. Avaliar intensidade, cores, movimento e integração com o título, mantendo legibilidade e respeitando redução de movimento. A versão atual não deve ser considerada aprovada.

Atualização: implementada uma nova versão com fotografia de destino, composição em duas colunas e gradiente animado integrado, considerando referências de sites de viagem. A avaliação do usuário continua pendente; isso não significa aprovação da direção visual.

Correção após feedback: a versão com foto foi rejeitada. A hero não deve conter imagens de destinos específicos. Fotografia e destaque de destino foram removidos; a direção atual é abstrata, com título centralizado, ações e gradiente animado vindo de baixo.

## Ideia: definir a duração da viagem pelo calendário

Permitir selecionar ida e volta em um calendário de intervalo e calcular automaticamente a quantidade de dias. Evitar pedir duração e datas como informações independentes que podem entrar em conflito.

Hoje o fluxo já aceita datas fixas e calcula a duração; a evolução proposta é apresentar essa escolha em um calendário integrado, com o intervalo destacado e a duração visível. Para datas flexíveis, manter a opção de informar apenas duração e período preferido.

Critérios de aceite propostos:

- Selecionar início e fim no mesmo calendário.
- Mostrar a duração imediatamente, contando os dias de ida e volta.
- Impedir volta anterior à ida e intervalos fora do limite aceito pelo gerador.
- Usar o mesmo intervalo na parametrização, no roteiro e na geração.
- Oferecer navegação por teclado e uma experiência adequada no celular.

## Problema: como popular o banco e mantê-lo atualizado?

O catálogo precisa crescer sem depender apenas de cadastro manual ou dados de teste. Também precisa continuar confiável quando preços, horários, estabelecimentos e condições mudarem.

Proposta para investigação: criar um processo de ingestão, normalização, revisão e atualização de dados, com uma carga inicial de destinos prioritários. Cada registro deve ter fonte, identificador externo quando disponível, data da última verificação e estado de qualidade. Importações precisam atualizar registros existentes sem duplicar cidades ou lugares.

Separar a frequência de atualização por tipo de informação: localização e contexto histórico tendem a mudar menos; horários, funcionamento e custos exigem verificações mais frequentes. Definir esses intervalos após avaliar as fontes, sua cobertura e o custo operacional.

Questões a decidir:

- Quais fontes permitem o uso, armazenamento e atualização dos dados necessários?
- Qual região e quantidade de destinos devem entrar primeiro?
- Quem revisa divergências e como o sistema trata dados desatualizados?
- Qual orçamento existe para aquisição de dados, fotos e atualizações?
- Como detectar locais fechados, importações incompletas e falhas recorrentes?

## Problema: como detalhar e enriquecer as descrições dos destinos?

Descrições genéricas ajudam pouco na decisão de viagem e oferecem pouco contexto para montar um roteiro personalizado.

Proposta: estruturar informações além do resumo, incluindo identidade do destino, bairros e regiões, experiências características, sazonalidade, deslocamentos, duração sugerida, perfis de viajante, acessibilidade e contexto dos custos. Apresentar nomes e textos em português, preservando nomes originais e aliases para busca.

Textos produzidos com auxílio de IA devem partir de informações verificáveis. Não preencher lacunas com fatos inventados. Manter referências e indicar quando uma informação ainda não está disponível.

Critério de qualidade proposto: a descrição deve ajudar a responder “por que ir?”, “o que combina comigo?”, “quando ir?” e “como organizar os dias?”, com detalhes próprios daquele destino.

## Problema: como popular melhor os pontos de interesse?

Ter apenas nomes e descrições curtas limita a variedade e a viabilidade dos roteiros. É necessário ampliar a cobertura de atrações, atividades, restaurantes e outros locais relevantes, com distribuição por região e perfil de viajante.

Dados prioritários para investigação:

- Identidade do local, categoria, coordenadas, endereço e relação com o destino.
- Descrição útil em português e tags consistentes, como Família, Natureza e Cultura.
- Fotos com origem e direitos de uso identificados.
- Horários por dia da semana, exceções e estado de funcionamento.
- Duração estimada da visita, custo, moeda e necessidade de reserva.
- Acessibilidade e restrições relevantes, quando houver dados confiáveis.
- Fonte, última verificação e completude das informações.

Proposta: deduplicar locais por identificador da fonte e, quando necessário, por nome e proximidade geográfica. Revisar amostras antes de publicar uma importação e permitir corrigir ou desativar locais sem perder seu histórico.

## Como isso melhora os roteiros gerados

Dados melhores permitem selecionar atividades compatíveis com o DNA e os parâmetros da viagem, equilibrar variedade e orçamento e explicar melhor cada escolha. Coordenadas, duração das visitas e horários de funcionamento permitem verificar se a programação cabe no dia e reduzir deslocamentos desnecessários.

Enriquecer o banco precisa vir acompanhado da evolução do gerador: ele deve consultar esses campos, respeitar as restrições e sinalizar dados ausentes. Mais registros, por si só, não garantem roteiros melhores. Atualmente o backend Nest usa um gerador mock; conectar ou evoluir a geração real é uma frente separada.

O intervalo fixo atual de 30 minutos entre atividades também deve evoluir para uma estimativa de deslocamento baseada em localização e transporte, quando houver dados suficientes.

## Ordem sugerida para investigação

1. Definir o mínimo de qualidade por destino e ponto de interesse, além das fontes e regras de uso.
2. Montar um catálogo piloto pequeno, enriquecido e revisado.
3. Criar importação repetível, deduplicação e atualização com rastreabilidade.
4. Fazer o gerador aproveitar os dados e avaliar os roteiros resultantes.
5. Evoluir o calendário de viagem e validar uma nova direção visual para a hero.

Indicadores sugeridos: cobertura e atualização dos campos essenciais, taxa de duplicação, atividades com horários válidos, respeito ao orçamento, tempo de deslocamento e avaliação do viajante após a viagem.
