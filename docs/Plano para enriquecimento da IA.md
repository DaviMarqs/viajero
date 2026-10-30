# Destinos e roteiros mais completos, sem depender de IA

Data: 29/10/2026. Status: proposta técnica; não implementada.

Este documento responde ao pedido de Felipe de melhorar os detalhes dos destinos e produzir programações reais, próximas entre si, com preços, descrições e dicas verificáveis. O diagnóstico considera o código atual do Viajero. As fontes externas foram consultadas nesta data; limites e condições devem ser conferidos novamente na implementação.

## 1. Caminho recomendado

Construir um catálogo próprio de lugares verificados, enriquecido por dados abertos e fontes oficiais. Gerar o roteiro com regras de preferência, localização, horários, duração e orçamento. Montar o texto com descrições licenciadas e modelos de frase baseados nos dados.

Isso permite funcionar sem LLM, sem chave de IA e sem pagar por cada geração. O trabalho principal passa a ser a qualidade do catálogo e das regras, não a escrita de um prompt maior.

**Limite importante:** não existe uma fonte gratuita universal que entregue todos os lugares, preços atuais, disponibilidade de ingressos, restaurantes, hotéis e horários corretos. A proposta é ter cobertura progressiva e mostrar claramente o que foi confirmado, estimado ou ainda não informado.

Começar com três cidades-piloto escolhidas pela equipe, um catálogo pequeno bem preenchido e roteiros a pé por região. Adicionar cobertura e integrações conforme a qualidade ficar comprovada. Não começar importando o mundo inteiro.

## 2. O que existe hoje e precisa mudar

Fatos observados no repositório:

| Parte atual | Comportamento observado | Consequência para a proposta |
| --- | --- | --- |
| `backend-nest/src/modules/destinations/discovery/destination-discovery.service.ts` | Descoberta combina Firecrawl e enriquecimento por LLM; disponibilidade considera essas fontes. | Criar um caminho de ingestão por dados abertos que funcione sem ambas. |
| `backend-nest/src/modules/destinations/discovery/firecrawl.client.ts` | Há extração orientada por prompt e schema. | Não considerar esse caminho uma solução independente de IA. HTTP e parsing estruturado podem substituí-lo. |
| `backend-nest/src/modules/destinations/discovery/wikipedia.ts` | Consulta a Wikipedia para imagem e tenta desambiguar o destino. | Reaproveitar comunicação e tratamento de falhas; acrescentar identificação estável e créditos. |
| `backend-nest/src/modules/destinations/entities.ts` | POI tem resumo, endereço, horários em texto, faixa de preço, avaliação, duração estimada e metadata. Não há colunas dedicadas de coordenadas no POI inspecionado. | A estrutura inicial é aproveitável, mas falta localização confiável, preço estruturado e origem por campo. |
| `backend-nest/src/modules/ai/itinerary-generators.ts` | Fallback `MockItineraryGenerator` distribui POIs em grupos de três, pode repetir lugares e usa custos `20 + eventIndex * 15`. | O mock não é um planejador real sem IA. Precisa de uma implementação determinística própria. |
| `backend-nest/src/common/factories/itinerary-generator.factory.ts` | A fábrica escolhe LLM quando há provedores; caso contrário escolhe mock. | Reaproveitar a interface e introduzir seleção explícita do planejador determinístico. |
| `backend-nest/src/modules/ai/itinerary/itinerary-costs.ts` | `applyBudgetPrecision` pode reescalar custos para encaixar na faixa mínima/máxima. | Preço publicado não pode ser alterado para caber no orçamento. Trocar atividades, não os preços. |
| `backend-nest/src/modules/ai/ai.service.ts` | Orquestra geração, aplica o ajuste de custos e persiste os dias em transação. | Reaproveitar persistência/transação; separar normalização monetária de manipulação de orçamento. |

A nomenclatura atual dos módulos não obriga o uso de IA. Para a primeira entrega, basta aproveitar a interface de geração existente; não é necessário renomear toda a arquitetura.

## 3. Fontes e o papel de cada uma

### 3.1 Base principal

| Fonte | O que pode fornecer | O que não resolve | Uso proposto e limites |
| --- | --- | --- | --- |
| OpenStreetMap e Overpass | Coordenadas, categorias, endereços e, quando cadastrados, site, horários, acessibilidade e características do estabelecimento. | Cobertura uniforme, avaliações de consumidores e preços completos. Tags ausentes significam desconhecido. | Importar por cidade/área, guardar IDs externos e trabalhar sobre cópia local. Instâncias públicas de Overpass são compartilhadas, não um backend ilimitado do produto. [Manual do Overpass](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html). |
| Wikidata | Identidade do lugar, coordenadas, relações, nomes em idiomas diferentes e ligações para outros projetos. | Descrição turística longa e informação operacional sempre atual. | Usar como ligação entre fontes, principalmente por QID. Dados estruturados são disponibilizados sob CC0. [Acesso a dados](https://www.wikidata.org/wiki/Wikidata:Data_access). |
| Wikipedia | Contexto histórico, cultural e geográfico do destino e de atrações relevantes. | Preços de hoje, reservas ou informação operacional garantida. | Importar trechos adequados com licença, referência e revisão de origem; priorizar português. Respeitar identificação e limites da API. [Política da API](https://www.mediawiki.org/wiki/API:REST_API/Policies). |
| Wikimedia Commons | Fotografias com página de origem, autoria e licença identificáveis. | Uma licença única para todas as imagens ou relevância automática para o local. | Guardar autor, arquivo, licença e atribuição; validar a correspondência com o destino. [Reutilização de conteúdo](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia). |
| Wikivoyage | Contexto de bairros, chegada, deslocamento e dicas de viagem redigidas por pessoas. | Atualização garantida de preços, qualidade uniforme ou cobertura de toda cidade. | Aproveitar conteúdo com atribuição e condições de compartilhamento. O texto redistribuído/adaptado segue CC BY-SA 4.0 conforme a política consultada; imagens têm regras próprias. [Copyleft](https://en.wikivoyage.org/wiki/Wikivoyage:Copyleft). |
| Sites oficiais de atrações, operadores e turismo municipal | Ingressos, dias gratuitos, horários, regras de entrada, reservas, contatos e avisos. | Um formato padrão ou uma autorização universal para copiar o conteúdo integral. | Priorizar APIs, arquivos públicos e JSON-LD; usar parsers específicos e curadoria quando necessário. O vocabulário [Schema.org Offer](https://schema.org/Offer) descreve ofertas e [OpeningHoursSpecification](https://schema.org/OpeningHoursSpecification) descreve horários, mas cada site decide o que publica. |

Não importar uma fotografia só porque o URL responde HTTP 200. Disponibilidade técnica, autorização de uso e identidade do lugar são verificações diferentes.

### 3.2 Complementos úteis

- **Nominatim:** resolver buscas pontuais por cidade/endereço. No servidor público da OSMF, o teto é uma requisição por segundo para o conjunto da aplicação; exige identificação e atribuição, recomenda cache e não permite autocomplete no cliente. Não serve para descobrir todos os POIs de uma região. [Política oficial](https://operations.osmfoundation.org/policies/nominatim/).
- **IBGE:** validar nomes, municípios, UFs e códigos brasileiros. Ajuda a distinguir cidades homônimas; não é catálogo de atrações nem de preços. [API de localidades](https://servicodados.ibge.gov.br/api/docs/localidades).
- **GTFS publicado por operadores:** paradas, linhas, calendários e, quando fornecidas, tarifas. O padrão prevê esses arquivos, mas a publicação e licença dependem do operador. Um feed não garante tempo real ou informação tarifária completa. [Referência GTFS](https://gtfs.org/documentation/schedule/reference/).
- **Extratos regionais da Geofabrik:** alternativa para importar OSM em lote e diminuir dependência de serviços públicos. Download gratuito não elimina custo de processar e atualizar os dados. [Downloads](https://www.geofabrik.de/data/download.html).
- **Clima:** opcional. A API aberta do Open-Meteo é indicada para uso não comercial e tem cotas; não deve ser apresentada como gratuita para qualquer exploração comercial. Para o núcleo estritamente gratuito, usar médias históricas publicadas ou omitir previsão quando não houver fonte compatível. Não confundir clima de uma época com previsão de uma data distante. [Condições atuais](https://open-meteo.com/en/pricing).

### 3.3 Deslocamentos e proximidade

**Base sem cobrança por consulta:** um motor de rotas aberto com dados regionais locais, por exemplo OSRM, preparado para o modal desejado. O OSRM oferece serviços de rota e matriz de tempo/distância. O perfil é definido no preparo dos dados: mudar o nome na URL não transforma uma instalação de carro em roteamento a pé. [Documentação](https://project-osrm.org/docs/v5.24.0/api/).

Para testar sem instalar um motor, openrouteservice oferece chave Standard gratuita, sujeita às condições e restrições do serviço. É uma alternativa de protótipo, não requisito do núcleo. Na consulta desta documentação, a página institucional exibia aviso de indisponibilidade, mas apontava acesso aos serviços e cadastro. Confirmar estado e limites antes de adotar. [Aviso e acesso oficial](https://openrouteservice.org/).

Não usar servidores de demonstração de rotas como infraestrutura permanente. Transporte público exige rede, calendário e horários, como GTFS; uma rota de carro não estima corretamente ônibus ou metrô.

## 4. Pipeline de enriquecimento sem IA

```text
Identificar cidade e área
  → obter dados estruturados permitidos
  → normalizar e ligar entidades
  → deduplicar e resolver conflitos
  → verificar campos críticos
  → publicar catálogo local com origem e validade
  → montar roteiro sobre esse catálogo
```

### 4.1 Identidade antes de descrição

1. Confirmar cidade, estado/região, país e área geográfica. Não usar somente o nome como chave.
2. Vincular IDs externos: QID de Wikidata, tipo/ID do elemento OSM e identificador oficial quando houver.
3. Guardar entrada e centroide do local separadamente quando disponíveis. O centro de um parque pode estar longe do acesso público.
4. Consultar POIs dentro da área confirmada. Não misturar atrações de municípios distantes porque compartilham o nome.

### 4.2 Aquisição e atualização

Prioridade: API/documento estruturado → JSON-LD de site oficial → parser HTML específico → preenchimento por curador.

JSON-LD pode conter listas e `@graph`; preço, moeda e validade devem ser associados à oferta e ao público correto. `priceRange` e faixas qualitativas não equivalem a preço de ingresso. Não extrair qualquer símbolo monetário da página com uma expressão regular genérica.

Selecionar fontes oficiais a partir de relações verificadas e uma lista de domínios aprovados. Não montar um robô que navega indiscriminadamente em qualquer URL encontrada.

Executar ingestão em lote, separada da abertura da página e da geração. Um roteiro deve poder ser calculado com o catálogo local mesmo quando uma fonte externa estiver indisponível. Se faltar dado crítico, reduzir o escopo e informar a lacuna.

### 4.3 Deduplicação e conflito

- IDs externos iguais são evidência forte, mas um lugar pode ter vários elementos OSM; manter aliases e relações.
- Na ausência de ID comum, combinar nome normalizado, endereço, categoria e distância. Um limiar de distância deve ser calibrado nas cidades-piloto.
- Não unir apenas por slug: nomes de igrejas, hotéis e praças se repetem.
- Priorizar, por campo, fonte oficial recente e específica; depois fontes abertas verificáveis. Um texto enciclopédico não deve substituir um aviso oficial de fechamento.
- Conflitos de preço, entrada ou horário ficam pendentes de revisão; não escolher silenciosamente o menor preço.

### 4.4 Curadoria faz parte da solução gratuita

Ter uma lista administrativa de lugares incompletos, fontes alteradas e conflitos. Um curador confere ingressos, dias gratuitos, acessos e dicas importantes. Não é necessário construir um painel novo inicialmente: pode começar com importação revisada e o mecanismo administrativo já disponível.

Cobertura pequena e boa é preferível a milhares de registros sem coordenadas, preço ou horário utilizável.

## 5. Contrato de dados e rastreabilidade

### Destino

Nome, região, país, IDs externos, área, fuso, idiomas, moeda, contexto cultural, bairros/regiões, formas de chegada, deslocamento, sazonalidade documentada, imagens licenciadas e avisos oficiais.

Cada seção pode ser incompleta. “Destino completo” deve indicar cobertura de campos definidos pela equipe, nunca certeza de que tudo está atualizado.

### Ponto de interesse

Nome e categoria; coordenadas da entrada; endereço; descrição; duração sugerida; duração publicada quando existir; horários e exceções; preço e condições; necessidade de reserva; contato/site oficial; acessibilidade; características alimentares; imagens; dicas e origem de cada informação.

Horário e duração são coisas diferentes: um museu aberto por oito horas não exige uma visita de oito horas. Duração sugerida por categoria deve ser rotulada como estimativa editorial.

### Origem por campo

Guardar `source_url`, identificador da fonte, licença quando aplicável, data da coleta, revisão/data publicada pela fonte quando disponível, validade, método de obtenção e estado de verificação.

Estados sugeridos: `official`, `community`, `editorial_estimate`, `unknown`, `stale`, `conflicting`. São classificações operacionais propostas, não probabilidades estatísticas.

Separar `fetched_at` de `verified_at`: baixar hoje uma página antiga não confirma o preço de hoje. Uma correção manual deve ter prioridade e não ser apagada automaticamente na próxima ingestão.

### Preço

Estrutura mínima proposta:

```json
{
  "amount_minor": null,
  "currency": "BRL",
  "basis": "per_person",
  "audience": "adult",
  "status": "unknown",
  "source_url": null,
  "verified_at": null,
  "valid_from": null,
  "valid_through": null,
  "reservation_required": null
}
```

Exemplo estrutural, não um preço real. `null` não é zero; gratuito exige evidência explícita. Regras de meia-entrada, idade, residência, dia gratuito e compra antecipada precisam de condições próprias. Valores em moedas diferentes não são somados antes de conversão datada e identificada.

Começar usando `metadata` para experimentar os campos opcionais. Coordenadas, IDs, preços e validade usados em busca, deduplicação e planejamento devem evoluir para colunas/relações validadas e indexáveis. Não transformar metadata em um banco paralelo sem contrato.

## 6. Preços reais e orçamento honesto

**Separar quatro naturezas de informação:** preço publicado; tarifa condicional; estimativa editorial; valor desconhecido.

- Ingresso: página oficial de bilheteria, com data e categoria de visitante.
- Transporte: tarifa do operador ou GTFS quando completo; guardar regras de integração e diferenças de modal.
- Alimentação: cardápio publicado e permitido, preço de itens ou faixa editorial identificada. “Tem opção vegana” não garante ausência de contaminação ou atendimento a qualquer restrição.
- Hospedagem: preços variam por datas, ocupação e disponibilidade. Sem consulta autorizada e compatível, mostrar faixa estimada ou link oficial, não uma diária supostamente disponível.
- Voos, disponibilidade de quartos e ingressos por sessão: deixar fora da promessa inicial de cobertura gratuita universal.

O orçamento da viagem precisa declarar se é por pessoa ou pelo grupo e quais itens inclui. A companhia “família” não informa quantos adultos/crianças existem. Antes de calcular totais de grupo, obter quantidades e condições de tarifa; até lá, apresentar base por pessoa com ressalva explícita.

Não multiplicar toda tarifa pelo número de dias: ingresso costuma ser por visita, hotel por noite e transporte pode ser por trecho/passe. Evitar dupla contagem de refeições e pacotes.

Se o orçamento conhecido for excedido, substituir opções, priorizar atrações gratuitas verificadas, reduzir deslocamentos ou informar inviabilidade. **Não reduzir matematicamente um preço real nem aumentar gastos para atingir o orçamento mínimo.**

Apresentar subtotal conhecido, estimativas e itens sem preço separadamente. Se faltar preço, não afirmar que a viagem cabe no teto. Guardar os preços/fontes usados no snapshot do roteiro; atualizar o catálogo não deve reescrever silenciosamente um planejamento anterior.

## 7. Como montar uma programação rica e próxima sem IA

### 7.1 Regras obrigatórias antes de preferências

Só considerar POIs no destino/região correta e que não estejam confirmadamente fechados. Verificar restrições de acesso, reservas e duração disponível. Para necessidade crítica de acessibilidade, informação ausente não é confirmação de atendimento; oferecer apenas itens verificados ou explicar que não há dados suficientes.

Usar datas e fuso do destino. Interpretar abertura, pausas, viradas de dia e exceções. A sintaxe `opening_hours` possui regras próprias; usar um interpretador compatível em vez de um parser improvisado. Feriados e fechamentos excepcionais precisam de fonte/calendário aplicável. [Formato OSM](https://wiki.openstreetmap.org/wiki/Key:opening_hours).

Com datas flexíveis, produzir uma sequência sugerida condicionada à escolha final das datas. Não alegar disponibilidade em um dia da semana que ainda não foi definido.

### 7.2 Seleção e agrupamento

1. Ranqueamento por interesses da viagem, usando categorias reais e pesos transparentes. O ranqueamento por tags já existente no projeto é um ponto de partida.
2. Filtrar candidatos dentro da mesma região e formar grupos geográficos por dia. Não exigir um algoritmo sofisticado no primeiro piloto.
3. Calcular uma matriz de tempos/distâncias para os candidatos finais, no modal correto. Para N lugares, a quantidade de pares cresce como N²; limitar candidatos e reutilizar matriz.
4. Escolher uma atração principal por período e atividades complementares próximas, com pausas e refeições. Ajustar densidade ao tempo de visita disponível e às preferências existentes.
5. Ordenar por inserção viável: encaixar a próxima visita que melhore afinidade/variedade sem violar horário, deslocamento ou orçamento.
6. Aplicar pequenas trocas de ordem para reduzir trajetos, revalidando horários e custos após cada troca.
7. Fazer uma validação final de todos os dias. Deixar tempo livre quando não houver boas opções; não repetir POIs para preencher dias.

Uma pontuação possível, a calibrar: afinidade + variedade + qualidade dos dados − tempo de deslocamento − incerteza operacional. Restrições obrigatórias são filtros, não pequenas penalidades que uma pontuação alta consegue superar.

Isso é uma heurística, não garantia de ótimo global. Para o Viajero, a prioridade inicial é um roteiro viável, explicável e reproduzível.

### 7.3 O que significa “próximo”

Distância em linha reta serve para descartar candidatos muito afastados, mas não confirma caminhabilidade. Rios, morros, rodovias, entradas e travessias mudam o percurso. Confirmar a proximidade final pela rede de ruas/trilhas.

Como parâmetro inicial de piloto, a equipe pode experimentar deslocamentos de até 20 minutos a pé entre visitas. Esse número é proposta de configuração, não uma regra já validada ou adequada a toda pessoa. Se nenhum trajeto for calculável, marcar “deslocamento não verificado”; não fabricar minutos.

Não inventar o ponto de partida. Se o usuário ainda não informou hospedagem/base, usar um ponto de encontro público explícito e deixar o acesso até ele fora do cálculo.

### 7.4 Agenda calculada, não horários decorativos

Para cada evento: chegada = saída anterior + deslocamento + margem; início = primeiro horário viável; saída = início + duração da visita. A visita inteira deve caber na janela de funcionamento. Considerar última entrada, reservas e tempo de espera somente quando houver dados ou uma estimativa identificada.

Guardar deslocamentos e pausas como partes explícitas do dia. Não colocar duas visitas longas coladas nem tratar caminhada como tempo gratuito. Se há poucos POIs adequados para vários dias, mostrar programação parcial e lacunas.

### 7.5 Descrições e dicas sem geração de texto

Combinar uma descrição factual licenciada, atributos estruturados e frases editoriais fixas. Exemplos de regra:

| Evidência disponível | Informação que pode ser apresentada |
| --- | --- |
| Página oficial exige compra antecipada | “Reserva antecipada obrigatória”, com link. |
| Regra oficial de gratuidade aplicável | “Entrada gratuita nesta condição”, com condição e data. |
| Visita calculada fora do funcionamento | Reagendar ou remover; não esconder o conflito em uma dica. |
| Rota entre entradas calculada | Informar tempo, distância, modal e caráter estimado do trajeto. |
| Horário não publicado | “Horário não confirmado; consulte o local.” |
| Apenas duração editorial da categoria | “Tempo de visita sugerido”, sem afirmar que foi medido. |

Não escrever “melhor restaurante”, “bairro seguro”, “sem filas”, “acessível” ou “melhor horário” sem evidência adequada. Segurança, alimentação e acessibilidade não devem ser inferidas de popularidade ou categoria.

O detalhe de cada evento deve responder: o que é; por que entrou no roteiro; o que observar/visitar; como chegar; quanto tempo reservar; preço e condições; horário; reserva; cuidados confirmados; origem e atualização. Se um campo faltar, omitir a afirmação e expor a lacuna relevante.

## 8. Encaixe na arquitetura do Viajero

Proposta de evolução, sem criar um segundo backend:

1. Acrescentar ingestão de fontes abertas ao módulo `destinations`, preservando interface e persistência existentes. Não exigir que `DestinationAiService` ou Firecrawl estejam disponíveis para enriquecer pelo caminho novo.
2. Reutilizar validação de imagens, normalização de categorias, entidades, tags e transações existentes; melhorar deduplicação por identidade/localização.
3. Implementar um gerador determinístico real sob a interface `BaseItineraryGenerator`. Manter o mock como dado de teste, não como resultado de produção.
4. Tornar a escolha desse gerador explícita: presença de chave de IA não pode ativar LLM no modo independente de IA.
5. Reaproveitar a orquestração/persistência de roteiro, mas retirar o reescalonamento de preços do caminho baseado em dados reais. Normalizar centavos e somar componentes continua necessário.
6. Reutilizar a sugestão por interesses existente para ranquear destinos do catálogo; incluir viabilidade de orçamento, época e cobertura dos dados. Explicar limites quando faltar informação.
7. Evoluir frontend/API para expor origem, validade, preço conhecido/estimado, deslocamentos e lacunas. Não apresentar avaliação ausente como zero estrelas reais.

O Django continua sendo o dono do schema neste repositório. Mudanças persistentes em modelos/colunas precisam de migrations Django, alinhamento das entidades TypeORM e atualização dos contratos TypeScript. Não ativar sincronização automática de schema como atalho.

Para o piloto, aproveitar PostgreSQL e um comando de ingestão com execução controlada. Não são necessários microserviços, uma fila distribuída, PostGIS ou um painel novo antes de existir um problema que justifique essas peças.

## 9. Atualização, limites e operação

Valores abaixo são sugestões iniciais de política do produto, não garantias das fontes:

| Tipo de dado | Política proposta |
| --- | --- |
| IDs e geografia | Revisar em ingestões periódicas, mantendo vínculos estáveis. |
| Contexto histórico | Cache longo com identificação da revisão. |
| Horários e regras | Revisão mais frequente; verificar exceções próximas da viagem. |
| Preços | Validade explícita; expirar confiança conforme a fonte e tipo de tarifa. |
| Avisos e eventos temporários | Expiração curta ou data final obrigatória. |
| Roteiro já salvo | Snapshot dos dados usados; mostrar avisos de mudanças sem alterar preços/agenda silenciosamente. |

Um TTL controla quando tentar atualizar; não prova que o dado ainda é verdadeiro. Respeitar `Retry-After`, backoff, cache negativo e concorrência limitada. Falha em uma fonte não deve apagar conteúdo curado nem interromper toda a navegação.

Wikimedia também aplica limites: usar identificação correta, observar respostas e não assumir acesso ilimitado por ser gratuito. [Diretrizes oficiais](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines).

No acesso a páginas externas, validar domínios/URLs, bloquear rede privada/localhost e revalidar redirecionamentos; limitar bytes, tempo e tipo de conteúdo. Sanitizar texto/HTML antes de exibir. Isso evita transformar o importador em acesso arbitrário à rede ou conteúdo ativo.

Para conteúdo: guardar atribuições e licenças; separar texto adaptado, dados estruturados e imagens. OSM possui regras de atribuição e condições sobre bases derivadas; não tratar a origem como uma única nota opcional no rodapé. [Diretrizes da OSMF](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).

Tiles de mapa têm política própria: usar dados OSM não autoriza baixar mapas em massa do servidor público. Renderização e dados são serviços distintos. [Política de tiles](https://operations.osmfoundation.org/policies/tiles/).

## 10. Plano incremental e critérios de aceite

### Entrega 1 — Catálogo confiável de uma cidade

Selecionar cidade-piloto, importar POIs, relacionar IDs e revisar manualmente os principais locais. Expor coordenadas, descrição, fonte, créditos, horários e estados desconhecidos.

Aceite: nenhuma duplicata evidente; nenhum POI fora da área sem justificativa; origem por campo crítico; informações desconhecidas não viram valores artificiais. Meta de cobertura inicial deve ser combinada após inspecionar a cidade, não inventada antes.

### Entrega 2 — Roteiro real a pé

Implementar seleção por interesses, agrupamento por região, matriz de deslocamento, encaixe de horários, pausas e persistência do resultado. Usar apenas o catálogo local, sem LLM/Firecrawl.

Aceite: mesmas entradas e versão do catálogo produzem o mesmo roteiro; não há sobreposição, POI duplicado para preencher agenda ou visita em fechamento conhecido; deslocamentos aparecem e são classificados corretamente.

### Entrega 3 — Preços e informação aprofundada

Integrar tarifas oficiais, condições, descrições licenciadas e dicas por regras. Separar subtotal conhecido, estimativas e custos pendentes.

Aceite: preço real nunca é reescalado; gratuidade tem fonte; moedas/bases de cobrança não se misturam; reservas e acessibilidade não são presumidas.

### Entrega 4 — Cobertura e atualização

Adicionar as demais cidades-piloto, ingestão programada, revisão de conflitos e acompanhamento de cobertura. Só então considerar transporte público, eventos ou otimização mais sofisticada.

Aceite: fonte indisponível não derruba geração com catálogo válido; mudanças não destroem snapshots anteriores; equipe consegue localizar e corrigir um registro problemático.

### Testes necessários

- Cidade homônima, duplicata por fontes diferentes e atração com entrada distante do centroide.
- Deslocamento sem caminho, barreira geográfica e modal incompatível.
- Horário com pausa, fechamento semanal, feriado conhecido, visita que cruza meia-noite e fuso da viagem.
- Dados ausentes, conflito de preço, gratuito condicional, validade expirada e moeda diferente.
- Família sem quantidade de pessoas: não produzir um total de grupo fictício.
- Orçamento insuficiente, poucos POIs para muitos dias e necessidade de acessibilidade sem comprovação.
- Fontes indisponíveis e execução com todas as chaves de IA ausentes: o caminho novo deve continuar funcionando.
- Conferência humana de roteiros-piloto, com correções alimentando regras e catálogo.

## 11. O que “grátis” significa aqui

O núcleo proposto não exige API paga nem inferência de IA: dados abertos, catálogo próprio, textos licenciados, regras determinísticas e motor de rotas local. Há custos de máquina, armazenamento, tráfego e tempo de manutenção. Podem caber no ambiente atual durante o piloto; não são zero por definição.

Serviços com plano gratuito são conveniências substituíveis. Licença aberta de dados não equivale a hospedagem gratuita ilimitada. A cobertura comercial de hotéis, voos, reservas e preços em tempo real fica fora da primeira versão.

**Recomendação final:** investir primeiro em identidade dos lugares, localização, horários, fontes e integridade dos preços. Com essa base, um planejador simples entrega roteiros mais confiáveis e úteis do que uma descrição longa baseada em dados não verificados.
