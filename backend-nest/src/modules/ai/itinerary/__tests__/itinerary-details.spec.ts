import { normalizeDayDetails, normalizeEventDetails, normalizeKind, normalizeTripGuide } from '../itinerary-details';

describe('normalizeKind', () => {
  it.each([
    ['attraction', 'attraction'],
    ['Passeio', 'attraction'],
    ['Refeição', 'meal'],
    ['restaurant', 'meal'],
    ['Transporte', 'transport'],
    ['hotel', 'lodging'],
    ['Hospedagem', 'lodging'],
    ['tempo livre', 'free_time'],
    ['free-time', 'free_time'],
    ['vida noturna', 'nightlife'],
    ['xyz', undefined],
    [null, undefined],
  ])('%p -> %p', (input, expected) => expect(normalizeKind(input)).toBe(expected));
});

describe('normalizeEventDetails', () => {
  it('le campos soltos ou dentro de details e descarta o que nao entende', () => {
    expect(
      normalizeEventDetails({
        kind: 'Refeicao',
        location: ' Chiado ',
        tip: 'Reserve',
        booking_required: 'sim',
        transit_to_next: { mode: 'a pe', minutes: '15 min', note: 'ladeira' },
      }),
    ).toEqual({ kind: 'meal', location: 'Chiado', tip: 'Reserve', booking_required: true, transit_to_next: { mode: 'a pe', minutes: 15, note: 'ladeira' } });
    expect(normalizeEventDetails({ details: { kind: 'hotel', booking_note: 'check-in 14h' } })).toEqual({ kind: 'lodging', booking_note: 'check-in 14h' });
    expect(normalizeEventDetails({ kind: 'abc', transit_to_next: { minutes: 5 } })).toEqual({});
  });
});

describe('normalizeDayDetails', () => {
  it('limita alternativas e dicas, valida data e normaliza custos', () => {
    const details = normalizeDayDetails({
      date: '2026-11-10',
      weekday: 'terca-feira',
      area: 'Belem',
      rain_plan: 'Museu dos Coches',
      alternatives: [{ title: 'A', estimated_cost: 'R$ 10,50' }, { title: '' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
      tips: ['um', '', 'dois', 'tres', 'quatro', 'cinco', 'seis'],
    });
    expect(details).toEqual({
      date: '2026-11-10',
      weekday: 'terca-feira',
      area: 'Belem',
      rain_plan: 'Museu dos Coches',
      alternatives: [{ title: 'A', estimated_cost: '10.50' }, { title: 'B' }, { title: 'C' }],
      tips: ['um', 'dois', 'tres', 'quatro', 'cinco'],
    });
    expect(normalizeDayDetails({ date: '10/11/2026' })).toEqual({});
  });
});

describe('normalizeTripGuide', () => {
  it('normaliza custos de referencia e junta as fontes http', () => {
    const guide = normalizeTripGuide(
      {
        weather: 'Ameno',
        neighborhoods: [{ name: 'Alfama', description: 'Fado' }, { description: 'sem nome' }],
        packing: 'guarda-chuva',
        cost_benchmarks: { meal_mid: 'R$ 80', hotel_night: '450.00', taxi_short: 'gratis' },
        sources: ['https://a.example', 'nao-e-url'],
      },
      ['https://pt.wikivoyage.org/wiki/Lisboa'],
    );
    expect(guide).toEqual({
      weather: 'Ameno',
      neighborhoods: [{ name: 'Alfama', description: 'Fado' }],
      packing: ['guarda-chuva'],
      cost_benchmarks: { meal_mid: '80.00', hotel_night: '450.00' },
      sources: ['https://a.example', 'https://pt.wikivoyage.org/wiki/Lisboa'],
    });
  });

  it('guia vazio vira undefined', () => {
    expect(normalizeTripGuide({ weather: '' })).toBeUndefined();
    expect(normalizeTripGuide('texto')).toBeUndefined();
  });
});
