import { MockItineraryGenerator } from '../itinerary-generators';

describe('generated schedule', () => {
  it('assigns non-overlapping hours using visit duration and bounds long visits', () => {
    const result = new MockItineraryGenerator().generate({
      itinerary: { title: 'Tokyo', destination: { name: 'Tokyo' }, duration_days: 1, currency_code: 'BRL' } as never,
      profile: null, preferences: null, promptTemplate: null,
      pois: [30, 90, 300].map((minutes, index) => ({ id: index + 1, name: `Local ${index}`, estimated_visit_minutes: minutes })) as never,
    });
    expect(result.days[0].events.map(event => [event.start_time, event.end_time])).toEqual([
      ['09:00', '09:30'], ['12:00', '13:30'], ['15:00', '17:30'],
    ]);
  });
});
