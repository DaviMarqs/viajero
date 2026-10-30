import { DestinationSuggestionService } from '../destination-suggestion.service';

const trip = {
  budget_min: 1000, budget_max: 3000, currency_code: 'BRL', companionship: 'solo',
  preferred_trip_length_days: 5, travel_month: 'December', hotel_level: 'budget',
  transportation_style: 'public', dietary_preferences: [], accessibility_needs: [],
  interests: ['nature'], metadata: { flexible_dates: true },
};

function setup() {
  const profile = { travel_style: 'balanced' };
  const saved = { budget_min: '10', interests: ['culture'] };
  const destination = { id: 1, name: 'Lisboa' };
  const destinations = { search: jest.fn().mockResolvedValue([destination]) };
  const profiles = { getDna: jest.fn().mockResolvedValue(profile), getTripPreference: jest.fn().mockResolvedValue(saved) };
  const ai = { isAvailable: () => true, suggest: jest.fn().mockResolvedValue({ name: 'Lisboa' }) };
  const service = new DestinationSuggestionService(destinations as never, profiles as never,
    { find: jest.fn().mockResolvedValue([]) } as never, { log: jest.fn() } as never, ai as never, {} as never);
  return { service, ai, profiles, profile, saved };
}

it('sugere usando os parâmetros desta viagem sem alterar as preferências salvas', async () => {
  const { service, ai, profiles, profile, saved } = setup();
  await Reflect.apply(service.suggest, service, [7, trip]);
  expect(ai.suggest).toHaveBeenCalledWith(profile, expect.objectContaining({
    budget_min: '1000', budget_max: '3000', interests: ['nature'], preferred_trip_length_days: 5,
  }), []);
  expect(profiles.getTripPreference).not.toHaveBeenCalled();
  expect(saved).toEqual({ budget_min: '10', interests: ['culture'] });
});

it('mantém compatibilidade com chamadas sem parâmetros de viagem', async () => {
  const { service, ai, profile, saved } = setup();
  await service.suggest(7);
  expect(ai.suggest).toHaveBeenCalledWith(profile, saved, []);
});

it('rejeita orçamento inválido antes de consultar a IA', async () => {
  const { service, ai } = setup();
  await expect(Reflect.apply(service.suggest, service, [7, { ...trip, budget_min: 4000 }])).rejects.toThrow();
  expect(ai.suggest).not.toHaveBeenCalled();
});
