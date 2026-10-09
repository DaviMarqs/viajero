import { canReviewItinerary, canViewItinerary, isPublicItinerary, resolveItineraryDefaults } from '../itinerary-rules';

const preferences = { preferred_trip_length_days: 4, budget_min: '2000.00', budget_max: '6000.00', currency_code: 'EUR' };

describe('resolveItineraryDefaults', () => {
  it('usa as preferencias quando o front manda so destino e titulo', () => {
    expect(resolveItineraryDefaults({ title: 'Lisboa' }, preferences, 'Lisbon')).toEqual({
      title: 'Lisboa',
      duration_days: 4,
      budget_total: '4000.00',
      currency_code: 'EUR',
    });
  });

  it('valores enviados vencem as preferencias', () => {
    expect(resolveItineraryDefaults({ title: 'X', duration_days: 7, budget_total: 1500, currency_code: 'brl' }, preferences, 'Lisbon')).toEqual({
      title: 'X',
      duration_days: 7,
      budget_total: '1500.00',
      currency_code: 'BRL',
    });
  });

  it('sem preferencias usa 5 dias, orcamento zero e BRL', () => {
    expect(resolveItineraryDefaults({}, null, 'Tokyo')).toEqual({ title: 'Roteiro Tokyo', duration_days: 5, budget_total: '0.00', currency_code: 'BRL' });
  });

  it('ignora duracao fora de 1 a 60 e titulo em branco', () => {
    expect(resolveItineraryDefaults({ title: '   ' }, { ...preferences, preferred_trip_length_days: 0 }, 'Rio').duration_days).toBe(5);
    expect(resolveItineraryDefaults({ title: '   ' }, { ...preferences, preferred_trip_length_days: 90 }, 'Rio')).toMatchObject({ title: 'Roteiro Rio', duration_days: 5 });
  });
});

describe('visibilidade de roteiros', () => {
  const ready = { generation_status: 'ready', metadata: {}, review_stats: { review_count: 0 } };

  it('roteiro pronto sem avaliacoes e privado', () => {
    expect(isPublicItinerary(ready)).toBe(false);
    expect(canViewItinerary(ready, false)).toBe(false);
    expect(canViewItinerary(ready, true)).toBe(true);
  });

  it('avaliado ou template vira publico', () => {
    expect(isPublicItinerary({ ...ready, review_stats: { review_count: 1 } })).toBe(true);
    expect(isPublicItinerary({ ...ready, review_stats: null, metadata: { is_template: true } })).toBe(true);
  });

  it('rascunho nunca e publico nem avaliavel', () => {
    const draft = { generation_status: 'draft', metadata: { is_template: true }, review_stats: { review_count: 3 } };
    expect(isPublicItinerary(draft)).toBe(false);
    expect(canReviewItinerary(draft, true)).toBe(false);
  });

  it('dono avalia o proprio roteiro pronto; visitante so se publico', () => {
    expect(canReviewItinerary(ready, true)).toBe(true);
    expect(canReviewItinerary(ready, false)).toBe(false);
    expect(canReviewItinerary({ ...ready, review_stats: { review_count: 2 } }, false)).toBe(true);
  });
});
