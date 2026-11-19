import type { GeneratedItinerary, ItineraryGenerationInput } from '../../itinerary-generators';
import { BaseItineraryGenerator } from '../../itinerary-generators';
import type { JsonObject, LlmProvider } from '../../llm/llm-provider';
import { requestLlmJson } from '../../llm/llm.service';
import type { LlmService } from '../../llm/llm.service';
import { LlmProviderError } from '../../llm/llm.errors';
import { TtlCache } from '../../../destinations/discovery/ttl-cache';
import { PipelineItineraryGenerator } from '../pipeline/pipeline-generator';
import { fixOverlaps, reviewItinerary } from '../pipeline/itinerary-quality';
import { fallbackPlan, normalizePlan } from '../pipeline/day-planner';
import { mapLimit, tripDates } from '../pipeline/shared';
import { fetchTravelSource, selectSections, TravelSource } from '../pipeline/travel-sources';

const pois = [
  { id: '1', name: 'Torre de Belem', poi_type: 'attraction', rating: '4.80', estimated_visit_minutes: 60, address: 'Belem', opening_hours: 'Ter-Dom 10h-18h', summary: 'Torre', price_level: 2, metadata: {} },
  { id: '2', name: 'Mosteiro dos Jeronimos', poi_type: 'attraction', rating: '4.90', estimated_visit_minutes: 90, address: 'Belem', opening_hours: '', summary: '', price_level: 2, metadata: {} },
  { id: '3', name: 'Castelo de Sao Jorge', poi_type: 'attraction', rating: '4.70', estimated_visit_minutes: 90, address: 'Alfama', opening_hours: '', summary: '', price_level: 2, metadata: {} },
];

const input = {
  itinerary: {
    id: '9', title: 'Roteiro Lisboa', duration_days: 2, currency_code: 'BRL', budget_total: '0.00', start_date: '2026-11-09', end_date: '2026-11-10', metadata: {},
    destination: { id: '4', name: 'Lisboa', country: 'Portugal', city: 'Lisboa', summary: 'Capital', best_season: 'Primavera' },
  },
  profile: { pace: 'moderate', travel_style: 'balanced', comfort_level: 'mid' },
  preferences: {
    budget_min: '1000', budget_max: '3000', currency_code: 'BRL', companionship: 'couple', preferred_trip_length_days: 2, travel_month: 'November',
    hotel_level: 'mid', transportation_style: 'public', dietary_preferences: [], accessibility_needs: [], interests: ['culture'], metadata: {},
  },
  pois,
  promptTemplate: { key: 'itinerary-generation', template: 'Seja criativo.' },
} as unknown as ItineraryGenerationInput;

const GUIDE = { weather: 'Ameno com chuva', getting_around: 'Metro e eletrico', cost_benchmarks: { meal_mid: '90', hotel_night: '400' } };
const ANALYSIS = { pois: [{ poi_id: 1, area: 'Belem', closed_days: ['segunda-feira'], ticket_cost: '50' }, { poi_id: 2, area: 'Belem' }, { poi_id: 3, area: 'Alfama' }] };
const PLAN = {
  title: 'Lisboa classica',
  summary: 'Dois dias.',
  lodging: { area: 'Baixa', suggestion: 'Hotel na Baixa', nightly_cost: '420' },
  days: [
    { day_number: 1, theme: 'Alfama', area: 'Alfama', poi_ids: [3] },
    { day_number: 2, theme: 'Belem', area: 'Belem', poi_ids: [1, 2] },
  ],
};
const day = (poiIds: number[], lodging: boolean) => ({
  title: 'Tema',
  summary: 'Resumo',
  area: 'Centro',
  rain_plan: 'Museu',
  alternatives: [{ title: 'Alt' }],
  tips: ['Dica'],
  events: [
    ...poiIds.map((id, index) => ({ kind: 'attraction', title: `POI ${id}`, description: '', start_time: `${10 + index * 2}:00`, end_time: `${11 + index * 2}:00`, estimated_cost: '40', poi_id: id })),
    { kind: 'meal', title: 'Almoco', description: '', start_time: '15:00', end_time: '16:00', estimated_cost: '90', poi_id: null },
    ...(lodging ? [{ kind: 'lodging', title: 'Hotel', description: '', start_time: '22:00', end_time: '23:00', estimated_cost: '999', poi_id: null }] : []),
  ],
});

type Responder = (prompt: string) => JsonObject;
const respond: Record<string, Responder> = {
  guide: () => GUIDE,
  analysis: () => ANALYSIS,
  plan: () => PLAN,
  day: (prompt) => (prompt.includes('Detalhe o dia 1 ') ? day([3], true) : day([1, 2], false)),
};

function stageOf(prompt: string): keyof typeof respond {
  if (prompt.includes('Monte o guia pratico')) return 'guide';
  if (prompt.includes('Analise os pontos de interesse')) return 'analysis';
  if (prompt.includes('Distribua as atracoes')) return 'plan';
  return 'day';
}

function setup(overrides: Partial<Record<keyof typeof respond, Responder | 'fail'>> = {}) {
  const prompts: string[] = [];
  const provider: LlmProvider = {
    key: 'groq',
    model: 'fake-model',
    generateJson: jest.fn(async (prompt: string) => {
      prompts.push(prompt);
      const stage = stageOf(prompt);
      const override = overrides[stage];
      if (override === 'fail') throw new LlmProviderError(`${stage} falhou`);
      return (override ?? respond[stage])(prompt);
    }),
  };
  const llm = { requestJson: (providers: LlmProvider[], request: never) => requestLlmJson(providers, request) } as unknown as LlmService;
  const fallback = { generate: jest.fn(async () => ({ title: 'single', summary: '', currency_code: 'BRL', estimated_cost: '0', days: [], metadata: { pipeline: 'single' } }) as GeneratedItinerary) };
  const generator = new PipelineItineraryGenerator(llm, [provider], { research: false, fallback: fallback as unknown as BaseItineraryGenerator });
  return { generator, prompts, fallback };
}

describe('PipelineItineraryGenerator', () => {
  it('fluxo feliz: guia, analise, plano e dias com detalhes, hospedagem unica e avisos', async () => {
    const { generator, prompts } = setup();
    const result = await generator.generate(input);
    expect(result.title).toBe('Lisboa classica');
    expect(result.guide?.cost_benchmarks).toEqual({ meal_mid: '90.00', hotel_night: '400.00' });
    expect(result.days).toHaveLength(2);
    expect(result.days[0].details).toMatchObject({ date: '2026-11-09', weekday: 'segunda-feira', theme: 'Alfama', rain_plan: 'Museu' });
    // Diaria do plano em todos os dias com pernoite; o ultimo dia nao tem diaria.
    const lodging = result.days[0].events.find((event) => event.details?.kind === 'lodging');
    expect(lodging?.estimated_cost).toBe('420.00');
    expect(result.metadata).toMatchObject({ pipeline: 'multi', generator: 'groq', model: 'fake-model', stages: { guide: true, planner: 'llm', poi_analysis: 3, days: 2 } });
    expect((result.metadata.quality as { warnings: string[] }).warnings).toEqual([]);
    // Prompts com secoes fixas e template adicional so no detalhamento.
    const dayPrompt = prompts.find((prompt) => prompt.includes('Detalhe o dia 2'));
    expect(dayPrompt).toContain('PAPEL:');
    expect(dayPrompt).toContain('TEMPLATE ADICIONAL:\nSeja criativo.');
    expect(dayPrompt).toContain('custos_referencia');
    expect(prompts.find((prompt) => prompt.includes('Distribua'))).not.toContain('TEMPLATE ADICIONAL');
  });

  it('pesquisa e analise falhando: segue sem guia', async () => {
    const { generator } = setup({ guide: 'fail', analysis: 'fail' });
    const result = await generator.generate(input);
    expect(result.guide).toBeUndefined();
    expect(result.metadata).toMatchObject({ pipeline: 'multi', stages: { guide: false, poi_analysis: 0 } });
  });

  it('planejador falhando: usa o plano deterministico', async () => {
    const { generator } = setup({ plan: 'fail' });
    const result = await generator.generate(input);
    expect(result.metadata).toMatchObject({ pipeline: 'multi', stages: { planner: 'fallback' } });
    expect(result.days).toHaveLength(2);
  });

  it('um dia falhando: cai no prompt unico', async () => {
    const { generator, fallback } = setup({ day: 'fail' });
    const result = await generator.generate(input);
    expect(fallback.generate).toHaveBeenCalled();
    expect(result.metadata).toMatchObject({ pipeline: 'single' });
    expect(result.metadata.pipeline_error).toContain('day falhou');
  });
});

describe('planejador', () => {
  const valid = new Set([1, 2, 3]);

  it('remove POI repetido entre dias e ids de fora; exige o numero de dias', () => {
    const plan = normalizePlan({ title: 't', days: [{ day_number: 1, theme: 'a', poi_ids: [1, 99, 2] }, { day_number: 2, theme: 'b', poi_ids: [2, 3] }] }, 2, valid, 'x');
    expect(plan.days.map((item) => item.poi_ids)).toEqual([[1, 2], [3]]);
    expect(() => normalizePlan({ days: [{ day_number: 1, theme: 'a', poi_ids: [] }] }, 2, valid, 'x')).toThrow(/2/);
  });

  it('fallback agrupa por area e evita o dia em que o POI fecha', () => {
    const insights = new Map([
      [1, { area: 'Belem', closed_days: ['segunda-feira'], booking_required: false, ticket_cost: 0 }],
      [2, { area: 'Belem', closed_days: [], booking_required: false, ticket_cost: 0 }],
      [3, { area: 'Alfama', closed_days: [], booking_required: false, ticket_cost: 0 }],
    ]);
    const ctx = { context: { duration_days: 2, profile: { pace: 'slow' } }, dates: tripDates('2026-11-09', 2) } as never;
    const plan = fallbackPlan(ctx, pois as never, insights, 'Roteiro', 400);
    // Ritmo lento: 2 por dia. A Torre (1) fecha na segunda (dia 1) e vai para o dia 2; o Mosteiro (mesma area) vai junto.
    expect(plan.days.map((item) => item.poi_ids)).toEqual([[3], [1, 2]]);
    expect(plan.days.map((item) => item.theme)).toEqual(['Alfama', 'Belem']);
    expect(plan.lodging).toEqual({ nightly_cost: 400 });
  });
});

describe('qualidade', () => {
  const event = (title: string, start: string, end: string, extra: object = {}) => ({ title, description: '', estimated_cost: '10.00', order_index: 0, start_time: start, end_time: end, ...extra });

  it('empurra o evento sobreposto para o fim do anterior, mantendo a duracao e o limite de 23:59', () => {
    const dayData = { title: 'd', summary: '', events: [event('a', '09:00', '11:00'), event('b', '10:00', '11:30'), event('c', '23:00', '23:50'), event('d', '23:30', '23:59')] };
    expect(fixOverlaps(dayData)).toBe(2);
    expect(dayData.events.map((item) => [item.start_time, item.end_time])).toEqual([['09:00', '11:00'], ['11:00', '12:30'], ['23:00', '23:50'], ['23:50', '23:59']]);
  });

  it('avisa refeicao e hospedagem faltando, POI repetido, atracao paga com custo 0 e dia longo no ritmo lento', () => {
    const result = {
      title: 't', summary: '', currency_code: 'BRL', estimated_cost: '0', metadata: {},
      days: [
        { title: 'd1', summary: '', events: [event('Torre', '08:00', '19:00', { poi_id: 1, estimated_cost: '0.00', details: { kind: 'attraction' } })] },
        { title: 'd2', summary: '', events: [event('Torre', '10:00', '11:00', { poi_id: 1, details: { kind: 'attraction' } }), event('Almoco', '12:00', '13:00', { details: { kind: 'meal' } })] },
      ],
    } as GeneratedItinerary;
    const insights = new Map([[1, { closed_days: [], booking_required: false, ticket_cost: 30 }]]);
    expect(reviewItinerary(result, { pace: 'slow', insights }).warnings).toEqual([
      'Dia 1: nenhuma refeicao planejada.',
      'Dia 1: sem hospedagem.',
      'Dia 1: "Torre" e pago, mas esta com custo 0.',
      'Dia 1: dia longo para um ritmo tranquilo.',
      'Dia 2: "Torre" repete um lugar do dia 1.',
    ]);
  });
});

describe('utilitarios', () => {
  it('mapLimit respeita o limite e a ordem', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapLimit([30, 10, 20, 5], 2, async (ms, index) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, ms));
      running -= 1;
      return index;
    });
    expect(result).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });

  it('tripDates calcula data e dia da semana; sem data so o numero', () => {
    expect(tripDates('2026-11-09', 2)).toEqual([
      { day_number: 1, date: '2026-11-09', weekday: 'segunda-feira' },
      { day_number: 2, date: '2026-11-10', weekday: 'terca-feira' },
    ]);
    expect(tripDates(null, 1)).toEqual([{ day_number: 1 }]);
  });
});

describe('Wikivoyage', () => {
  const extract = [
    'Lisboa e a capital de Portugal.',
    '== Entenda ==',
    'Historia longa. '.repeat(200),
    '== Compras ==',
    'Lojas.',
    '== Circular ==',
    'Metro e eletrico 28.',
    '=== Clima ===',
    'Chove no inverno.',
  ].join('\n');

  it('escolhe as secoes uteis e corta o tamanho', () => {
    const sections = selectSections(extract, 'pt');
    expect(Object.keys(sections)).toEqual(['intro', 'Entenda', 'Circular', 'Clima']);
    expect(sections.Entenda.length).toBe(1500);
    expect(sections.Compras).toBeUndefined();
  });

  it('busca pt e depois en, envia so o nome do destino e guarda em cache (inclusive a falha)', async () => {
    const calls: string[] = [];
    const fetchFn = jest.fn(async (url: string) => {
      calls.push(url);
      const pages = url.startsWith('https://pt.') ? [{ title: 'Lisboa', missing: true }] : [{ title: 'Lisbon', extract: `${'Intro. '.repeat(50)}\n== Get around ==\nMetro.` }];
      return { ok: true, json: async () => ({ query: { pages } }) } as Response;
    });
    const cache = new TtlCache<TravelSource | null>();
    const source = await fetchTravelSource(['Lisboa'], fetchFn as never, cache);
    expect(source?.url).toBe('https://en.wikivoyage.org/wiki/Lisbon');
    expect(source?.sections['Get around']).toBe('Metro.');
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]).searchParams.get('titles')).toBe('Lisboa');
    await fetchTravelSource(['Lisboa'], fetchFn as never, cache);
    expect(calls).toHaveLength(2);

    const failing = jest.fn(async () => ({ ok: false }) as Response);
    expect(await fetchTravelSource(['Nada'], failing as never, cache)).toBeNull();
    expect(await fetchTravelSource(['Nada'], failing as never, cache)).toBeNull();
    expect(failing).toHaveBeenCalledTimes(2); // pt + en, uma vez so
  });
});
