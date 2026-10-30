import 'reflect-metadata';
import { requireTripParameters } from './trip-generation-context';

const parameters = { budget_min: 0, budget_max: 1500, currency_code: 'BRL', companionship: 'family', preferred_trip_length_days: 5, travel_month: 'Outubro', hotel_level: 'mid', transportation_style: 'mixed', dietary_preferences: [], accessibility_needs: [], interests: ['nature'] };
describe('required trip generation parameters', () => {
  it('requires complete trip-specific parameters even when defaults exist elsewhere', () => {
    expect(() => requireTripParameters(undefined)).toThrow();
    expect(() => requireTripParameters({ budget_max: 100 })).toThrow();
    expect(() => requireTripParameters({ ...parameters, budget_min: 2000 })).toThrow();
    expect(() => requireTripParameters({ ...parameters, interests: [] })).toThrow();
  });
  it('accepts a complete trip and creates an independent snapshot', () => {
    const current = { ...parameters, interests: ['nature'] };
    const snapshot = requireTripParameters(current);
    current.budget_max = 9000;
    current.interests.push('shopping');
    expect(snapshot.budget_max).toBe(1500);
    expect(snapshot.interests).toEqual(['nature']);
  });
});
