import { validateTripMetadata } from '../trip-generation-context';
import { buildItineraryPrompt } from '../../ai/itinerary/itinerary-prompt';

describe('trip availability and dinner', () => {
  it('accepts old preferences and valid clocks', () => {
    expect(() => validateTripMetadata(undefined, 1)).not.toThrow();
    expect(() => validateTripMetadata({ arrival_time: '09:00', departure_time: '18:00', dinner_preference: 'mixed' }, 1)).not.toThrow();
    expect(() => validateTripMetadata({ arrival_time: '23:00', departure_time: '06:00' }, 2)).not.toThrow();
  });
  it.each([{ arrival_time: '24:00' }, { departure_time: '9:00' }, { dinner_preference: 'other' }, { arrival_time: '18:00', departure_time: '18:00' }])('rejects invalid metadata %p', metadata => {
    expect(() => validateTripMetadata(metadata, 1)).toThrow();
  });
  it.each(['all', 'none', 'mixed'])('includes availability and dinner %s in the prompt', dinner => {
    const prompt = buildItineraryPrompt({ destination: { id: 1, name: 'Rio', country: 'Brasil', city: '', summary: '' }, duration_days: 3, currency_code: 'BRL', pois: [], preferences: { budget_min: '100', budget_max: '500', currency_code: 'BRL', preferred_trip_length_days: 3, companionship: null, travel_month: null, hotel_level: null, transportation_style: null, dietary_preferences: [], accessibility_needs: [], interests: [], arrival_time: '16:00', departure_time: '10:00', dinner_preference: dinner } }, null);
    expect(prompt).toContain('antes de 16:00');
    expect(prompt).toContain('terminar até 10:00');
    expect(prompt).toContain(`"dinner_preference":"${dinner}"`);
    if (dinner === 'mixed') expect(prompt).toContain('metade arredondada para baixo');
    if (dinner === 'none') expect(prompt).toContain('Nenhum jantar');
    if (dinner === 'all') expect(prompt).toContain('Todos os jantares');
  });
});
