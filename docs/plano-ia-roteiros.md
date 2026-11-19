# Plano: IA de roteiros mais completa (pipeline em etapas)

> Status: **implementado** em 2026-11-19 (ainda não commitado).
> Escopo combinado: backend + frontend, com todas as melhorias: eventos mais ricos, guia prático, plano B e alternativas, prompt e qualidade.
> Pedido extra do usuário: *"dados mais assertivos, uma pesquisa maior e talvez fragmentada (em vez de um prompt gigante, vários, um para cada propósito)"*.

---

## 1. Como funciona hoje

- `backend-nest/src/modules/ai/itinerary/itinerary-prompt.ts` monta **um único prompt** (string longa, sem mensagem de sistema e sem exemplo) e o schema `ITINERARY_SCHEMA`.
- `itinerary-generators.ts`: o `LlmItineraryGenerator` chama `LlmService.requestJson` (cadeia de provedores Groq/Gemini/DeepSeek, com 2 tentativas por provedor e prompt reforçado). O `MockItineraryGenerator` é usado quando não há chave.
- `itinerary-normalizer.ts` normaliza a resposta (horários, custos, `poi_id` válido, quantidade de dias).
- `itinerary-costs.ts` → `applyBudgetPrecision` reescala os custos para a faixa de orçamento.
- `ai.service.ts` → `runJob` grava, numa transação, o roteiro, os dias (`itineraries_itineraryday`) e os eventos (`itineraries_itinerarydailyevent`).
- `common/factories/itinerary-generator.factory.ts` escolhe LLM ou mock.

### Limitações
1. O evento não tem **tipo** (passeio, refeição, transporte, hospedagem), então o front não diferencia nem soma o custo por categoria.
2. Os POIs vão ao prompt **sem endereço, horário de funcionamento ou resumo**, então a IA não agrupa por proximidade nem respeita o horário de funcionamento.
3. Não há **guia prático** (clima, locomoção, dinheiro, segurança, o que levar).
4. Não há **plano B** para chuva nem **alternativas**.
5. Um prompt gigante faz cada dia "chutar" preços diferentes, sem uma referência de custos comum.
6. O prompt não usa nenhuma fonte externa; tudo vem da memória do modelo.

---

## 2. Arquitetura proposta: pipeline em etapas

```
            ┌──────────────────────────┐   ┌───────────────────────────┐
 Etapa 1a   │ Pesquisa do destino      │   │ Análise dos POIs          │  Etapa 1b
 (paralelo) │ Wikivoyage + LLM → Guia  │   │ bairro, melhor horário,   │  (paralelo)
            │ + referência de custos   │   │ reserva, ingresso, fecha  │
            └────────────┬─────────────┘   └─────────────┬─────────────┘
                         └──────────────┬────────────────┘
                                        ▼
                       Etapa 2: Planejador (esqueleto)
                       dias → tema, área, poi_ids, hospedagem única
                       (fallback determinístico se falhar)
                                        ▼
                       Etapa 3: Detalhamento POR DIA (paralelo, limite de concorrência)
                       eventos com tipo/horário/custo ancorado na referência,
                       deslocamento, dica, reserva, plano B, alternativas
                                        ▼
                       Etapa 4: Qualidade (determinística)
                       corrige sobreposição, avisos, applyBudgetPrecision
```

- **Fallback geral:** se o pipeline falhar, o código cai no `LlmItineraryGenerator` atual (prompt único). Se a pesquisa (1a/1b) falhar, o pipeline segue sem ela.
- **Variável de ambiente nova:** `ITINERARY_PIPELINE=multi` (padrão) ou `single`. Também `ITINERARY_DAY_CONCURRENCY` (padrão 3), por causa do rate limit.
- O `LlmProvider.generateJson(prompt, schema, options)` **não muda**. Os prompts passam a ter seções fixas: PAPEL / TAREFA / DADOS / REGRAS / SAÍDA.
- O `PromptTemplate` do banco ("Template adicional") continua sendo anexado aos prompts do detalhamento dos dias.

### Etapa 1a: pesquisa do destino (`pipeline/guide-research.ts`)
- **Fonte externa:** Wikivoyage, pt e depois en (`https://{lang}.wikivoyage.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=X`). Pega as seções relevantes (Entenda/Clima, Circular/Get around, Comer, Segurança, Respeito), corta em ~1500 caracteres por seção e ~6000 no total. Usa o `TtlCache` de `destinations/discovery/ttl-cache.ts`. O User-Agent é genérico e a requisição envia **só o nome do destino**, nenhum dado do usuário.
- **O LLM recebe:** destino, mês e datas, perfil e preferências e o texto da fonte. **Devolve:** um `TripGuide`, que inclui `cost_benchmarks` (refeição econômica/média/alta, passagem de transporte público, táxi curto, diária de hotel no nível pedido, ingresso típico).
- `sources` registra as URLs usadas.

### Etapa 1b: análise dos POIs (`pipeline/poi-analysis.ts`)
- **Entrada:** POIs com `address`, `opening_hours`, `summary` (truncado), `price_level`, `estimated_visit_minutes`, `metadata` e tags.
- **Saída:** por POI, `area`, `best_time_of_day`, `closed_days`, `booking_required`, `ticket_cost`.

### Etapa 2: planejador (`pipeline/day-planner.ts`)
- **Entrada:** a duração e cada dia com sua **data e dia da semana**, calculados a partir de `start_date` para cruzar com os dias em que cada POI fecha. Também recebe o ritmo do perfil, os interesses, os bairros do guia, o clima e os POIs analisados.
- **Saída:** `title`, `summary`, `lodging {area, suggestion, nightly_cost}` e `days[{day_number, theme, area, poi_ids[]}]`.
- **Validação:** ids válidos, nenhum POI repetido entre dias, número de dias igual à duração.
- **Fallback determinístico:** distribuir os POIs por nota, agrupados por área quando houver.

### Etapa 3: detalhamento por dia (`pipeline/day-detailer.ts`)
- Uma chamada por dia, **em paralelo** com limite de concorrência (helper `mapLimit`).
- **Entrada:** o plano do dia, os POIs do dia, os `cost_benchmarks`, a hospedagem escolhida, a dieta, a acessibilidade, o transporte, o **orçamento-alvo do dia** (faixa ÷ dias) e os temas dos outros dias, para não repetir.
- **Saída por evento:** `kind`, `title`, `description`, `start_time`, `end_time`, `estimated_cost`, `poi_id`, `location`, `tip`, `booking_required`, `booking_note` e `transit_to_next {mode, minutes, note}`.
- **Saída por dia:** `title`, `summary`, `area`, `rain_plan`, `alternatives[≤3]`, `tips[≤5]`.
- **Regras:** pelo menos uma refeição por dia; hospedagem em todos os dias exceto o último (quando houver mais de um dia), usando o mesmo hotel e a mesma diária; custos ancorados na referência de custos; respeitar o horário de funcionamento e o dia da semana.
- `transit_to_next` é **só informativo**. O custo de transporte fica em eventos `kind=transport`, para não ser contado duas vezes.

### Etapa 4: qualidade (`pipeline/itinerary-quality.ts`)
- Corrige sobreposição de horários deslocando o início para o fim do evento anterior, mantendo a duração e limitando a 23:59.
- Gera avisos e grava em `generation_context.quality.warnings`: dia sem refeição, dia sem hospedagem, POI repetido, dia longo demais para o ritmo `slow`, atração paga com custo 0.
- Depois aplica `applyBudgetPrecision`, que já existe.

---

## 3. Persistência

| Dado | Onde |
|---|---|
| Detalhes do evento (`EventDetails`) | **nova coluna** `details jsonb NOT NULL DEFAULT '{}'` em `itineraries_itinerarydailyevent` |
| Detalhes do dia (`DayDetails`: área, plano B, alternativas, dicas, data/dia da semana) | **nova coluna** `details jsonb NOT NULL DEFAULT '{}'` em `itineraries_itineraryday` |
| Guia da viagem (`TripGuide`) | `itinerary.metadata.trip_guide`. Apagar a chave quando a geração cair no prompt único sem guia |
| Avisos de qualidade, etapas executadas, provedores e tempos | `itinerary.generation_context` (via `result.metadata`) |

Tarefas relacionadas:
- Migration nova em `backend-nest/src/database/migrations/` (o Django é legado; o Nest controla o schema pela tabela `nest_migrations`).
- Adicionar `@Column({ type: 'jsonb', default: () => "'{}'" }) details` em `ItineraryDay` e `ItineraryDailyEvent` (`modules/itineraries/entities.ts`).
- **Ajustar `src/database/__tests__/baseline.spec.ts`**: hoje ele exige que toda coluna das entidades exista na baseline. É preciso aceitar as colunas criadas por migrations posteriores (ex.: um conjunto `COLUMNS_FROM_LATER_MIGRATIONS`).
- `ai.service.ts → runJob`: gravar `details` em dias e eventos e `metadata.trip_guide`.
- `itineraries/itinerary-program.ts`: incluir `details` (opcional) em `ProgramSnapshotEvent`/`RestoredEventFields` e no snapshot do dia, para o **desfazer** não perder os detalhes ao recriar eventos. Conferir `itinerary-program.service.ts` (linhas ~66–81).

---

## 4. Frontend (`front/src`)

- `types/travel.ts`: tipos `EventKind`, `EventDetails`, `DayDetails`, `TripGuide`; `details?` em `ItineraryEvent` e `ItineraryDay`.
- `features/itineraries/itinerary-activity.tsx`: ícone/selo por tipo, local, dica, selo "reserva necessária" e "→ 15 min a pé até o próximo".
- `pages/roteiros/roteiro-detalhe.tsx`:
  - card **"Guia da viagem"** (clima, como se locomover, bairros, dinheiro/gorjeta, segurança, etiqueta, o que levar, frases úteis, eventos locais, documentos/saúde, fontes);
  - por dia: área, **plano B (chuva)**, **alternativas** e dicas.
- `features/itineraries/itinerary-insights.ts`: **custo por categoria** (`kind`), calculado no front para continuar valendo depois de edições.

---

## 5. Testes a escrever / ajustar

- `itinerary-details.ts`: `normalizeKind` (aliases pt/en), `normalizeEventDetails`, `normalizeDayDetails`, `normalizeTripGuide`.
- Pipeline com provedores falsos: o fluxo feliz; a pesquisa falhando (segue sem guia); o planejador falhando (fallback determinístico); um dia falhando (fallback para o prompt único).
- Qualidade: correção de sobreposição e avisos.
- Wikivoyage com `fetch` falso: seleção de seções, truncamento e cache.
- `baseline.spec.ts` com as colunas novas.
- Snapshot/restore do programa com `details`.
- **Linha de base antes das mudanças:** `npx jest` → **29 suítes / 224 testes passando** (2026-11-19).

---

## 6. Progresso

Todos os passos foram implementados (2026-11-19):

- Backend: `itinerary-details.ts`, prompt único enriquecido (`kind`, `location`, `tip` e POIs com endereço, horário, resumo e preço), pipeline em `ai/itinerary/pipeline/` (`shared`, `travel-sources`, `guide-research`, `poi-analysis`, `day-planner`, `day-detailer`, `itinerary-quality`, `pipeline-generator`), factory com `ITINERARY_PIPELINE`, `ITINERARY_DAY_CONCURRENCY` e `ITINERARY_RESEARCH`, migration `1795564800000-ItineraryDetails`, entidades, `baseline.spec.ts`, `runJob` e snapshot/restore com `details`.
- Frontend: tipos, selo por tipo, local, dica, reserva e deslocamento na atividade; área, plano B, alternativas e dicas por dia; card "Guia da viagem"; custo por categoria.
- Testes: 31 suítes / 254 testes no backend; lint, build e smoke HTTP OK; front com lint, build e testes OK.
- Diferenças em relação ao plano: o `applyBudgetPrecision` continua sendo aplicado só no `AiService` (vale para todos os geradores, então a etapa 4 não o repete). No último dia, os eventos de hospedagem ficam com custo 0. O plano determinístico mantém juntos os POIs da mesma área e evita colocar um POI num dia em que ele fecha.

### Pontos de atenção
- **Custo e tempo:** o pipeline faz 3 + N chamadas (N = dias) em vez de 1. O tempo total fica em `generation_context.elapsed_ms` e o tempo de cada etapa em `generation_context.trace`. Se ficar lento, reduza `ITINERARY_DAY_CONCURRENCY` ou use `ITINERARY_PIPELINE=single`.
- **Rate limit do Groq:** o `sendWithRateLimitRetry` já trata o HTTP 429, e a concorrência de dias é configurável.
- **Hospedagem:** com "noites = dias − 1", o total muda em relação aos roteiros antigos. É o esperado.
- **Dados do usuário:** para a Wikivoyage vai só o nome do destino.
