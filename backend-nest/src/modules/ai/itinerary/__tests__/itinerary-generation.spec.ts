import { applyBudgetPrecision, parseCost } from '../itinerary-costs';
import { buildItineraryContext, buildItineraryPrompt } from '../itinerary-prompt';
import { normalizeClock, normalizeItineraryPayload } from '../itinerary-normalizer';
import { LlmResponseError } from '../../llm/llm.errors';
import type { GeneratedItinerary } from '../../itinerary-generators';

describe('parseCost', () => {
  it.each([
    [120, 120],
    ['80.00', 80],
    ['R$ 1.200,50', 1200.5],
    ['1,200.50', 1200.5],
    ['120 reais', 120],
    ['12,5', 12.5],
    ['-30', 30],
    [null, 0],
    ['gratis', 0],
    ['1.2.3', 0],
  ])('%p -> %p', (input, expected) => expect(parseCost(input)).toBe(expected));
});

const itinerary = (days: number[][]): GeneratedItinerary => ({
  title: 'T',
  summary: '',
  currency_code: 'USD',
  estimated_cost: '999',
  metadata: {},
  days: days.map((costs, index) => ({ title: `D${index}`, summary: '', events: costs.map((cost, order_index) => ({ title: 'e', description: '', estimated_cost: String(cost), order_index })) })),
});

describe('applyBudgetPrecision', () => {
  it('recalcula dia e total pela soma dos eventos e usa a moeda da viagem', () => {
    const result = applyBudgetPrecision(itinerary([[10, 20.5], [30]]), { budget_min: '0', budget_max: '0', currency_code: 'BRL' });
    expect(result.days.map((day) => day.estimated_cost)).toEqual(['30.50', '30.00']);
    expect(result.estimated_cost).toBe('60.50');
    expect(result.currency_code).toBe('BRL');
  });

  it('reescala para o maximo quando passa do orcamento', () => {
    const result = applyBudgetPrecision(itinerary([[100, 100], [200]]), { budget_min: 100, budget_max: 200, currency_code: 'BRL' });
    expect(result.days[0].events.map((event) => event.estimated_cost)).toEqual(['50.00', '50.00']);
    expect(result.estimated_cost).toBe('200.00');
  });

  it('reescala para o minimo quando fica abaixo', () => {
    const result = applyBudgetPrecision(itinerary([[10], [10]]), { budget_min: 1000, budget_max: 2000 });
    expect(result.estimated_cost).toBe('1000.00');
  });
});

const destination = { id: '4', name: 'Lisbon', country: 'Portugal', city: 'Lisbon', summary: 'Capital', best_season: 'Primavera' };
const baseItinerary = { id: '9', title: 'Roteiro Lisbon', destination, duration_days: 2, currency_code: 'BRL', budget_total: '0.00', start_date: '2026-11-10', end_date: '2026-11-11' };
const tripParameters = {
  budget_min: '1000', budget_max: '3000', currency_code: 'BRL', companionship: 'couple', preferred_trip_length_days: 2, travel_month: 'November',
  hotel_level: 'mid', transportation_style: 'public', dietary_preferences: ['vegan'], accessibility_needs: ['mobility'], interests: ['food', 'culture'], metadata: {},
};

describe('buildItineraryPrompt', () => {
  const context = buildItineraryContext(baseItinerary as never, null, tripParameters as never, [
    { id: '1', name: 'Belem Tower', poi_type: 'attraction', rating: '4.80', estimated_visit_minutes: 60 },
    { id: '2', name: 'Time Out Market', poi_type: 'restaurant', rating: '4.90', estimated_visit_minutes: 90 },
  ] as never);

  it('ordena POIs pela nota e traduz preferencias', () => {
    expect(context.pois.map((poi) => poi.id)).toEqual([2, 1]);
    expect(context.preferences).toMatchObject({ companionship: 'casal', hotel_level: 'intermediaria', interests: ['gastronomia', 'cultura'], dietary_preferences: ['vegana'] });
  });

  it('pede portugues, horarios, faixa de orcamento e omite budget_total zerado', () => {
    const prompt = buildItineraryPrompt(context, { template: 'Seja criativo.' });
    expect(prompt).toContain('EXATAMENTE 2 dias para Lisbon (Portugal)');
    expect(prompt).toContain('entre 1000 e 3000 BRL');
    expect(prompt).toContain('portugues do Brasil');
    expect(prompt).toContain('HH:MM');
    expect(prompt).toContain('mobilidade reduzida');
    expect(prompt).toContain('A viagem vai de 2026-11-10 a 2026-11-11');
    expect(prompt).toContain('Template adicional:\nSeja criativo.');
    expect(prompt).not.toContain('budget_total');
  });
});

describe('normalizeItineraryPayload', () => {
  const input = { fallbackTitle: 'Roteiro Lisbon', currencyCode: 'BRL', durationDays: 2, validPoiIds: new Set([1, 2]) };

  it('descarta poi_id de outro destino, normaliza horarios e corta dias extras', () => {
    const result = normalizeItineraryPayload(
      {
        title: 'Lisboa a dois',
        days: [
          {
            title: 'Belem',
            events: [
              { poi_id: 1, title: 'Torre', description: 'Visita', start_time: '9:00', end_time: '10:30', estimated_cost: 'R$ 50', order_index: 3 },
              { poi_id: 99, title: 'Outro', description: '', start_time: '11:00', end_time: '10:00', estimated_cost: 10 },
              { poi_id: '2', title: 'Mercado', start_time: 'meio-dia' },
              { title: '' },
            ],
          },
          { title: 'Alfama', events: [] },
          { title: 'Extra', events: [] },
        ],
      },
      input,
    );
    expect(result.title).toBe('Lisboa a dois');
    expect(result.days).toHaveLength(2);
    expect(result.days[0].events).toEqual([
      { poi_id: 1, title: 'Torre', description: 'Visita', estimated_cost: '50.00', start_time: '09:00', end_time: '10:30', order_index: 0 },
      { poi_id: undefined, title: 'Outro', description: '', estimated_cost: '10.00', start_time: '11:00', end_time: undefined, order_index: 1 },
      { poi_id: 2, title: 'Mercado', description: '', estimated_cost: '0.00', start_time: undefined, end_time: undefined, order_index: 2 },
    ]);
  });

  it('ordena os eventos do dia pelo horario', () => {
    const result = normalizeItineraryPayload(
      { title: 'x', days: [{ title: 'a', events: [{ title: 'Check-in', start_time: '14:00' }, { title: 'Cafe', start_time: '08:00' }, { title: 'Almoco', start_time: '12:30' }] }] },
      { ...input, durationDays: 1 },
    );
    expect(result.days[0].events.map((event) => [event.title, event.order_index])).toEqual([['Cafe', 0], ['Almoco', 1], ['Check-in', 2]]);
  });

  it('sem dias validos pede nova tentativa ao LLM', () => {
    expect(() => normalizeItineraryPayload({ title: 'x', days: [] }, input)).toThrow(LlmResponseError);
  });

  it('modo estrito exige todos os dias com eventos', () => {
    const oneDay = { title: 'x', days: [{ title: 'a', events: [{ title: 'e' }] }] };
    expect(() => normalizeItineraryPayload(oneDay, { ...input, strict: true })).toThrow('o roteiro veio com 1 dia(s), mas eram esperados exatamente 2');
    const emptySecond = { title: 'x', days: [{ title: 'a', events: [{ title: 'e' }] }, { title: 'b', events: [] }] };
    expect(() => normalizeItineraryPayload(emptySecond, { ...input, strict: true })).toThrow('o dia 2 veio sem eventos');
    expect(normalizeItineraryPayload(oneDay, input).days).toHaveLength(1);
  });

  it('normalizeClock aceita segundos e recusa horario impossivel', () => {
    expect(normalizeClock('08:15:00')).toBe('08:15');
    expect(normalizeClock('24:00')).toBeUndefined();
  });
});
