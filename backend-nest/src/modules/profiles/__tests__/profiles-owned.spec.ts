import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfilesService } from '../profiles.service';

const DNA = { travel_style: 'balanced', pace: 'moderate', comfort_level: 'mid', social_energy: 5, adventure_level: 5, food_focus: 5, cultural_interest: 5, nature_interest: 5, nightlife_interest: 5 };

describe('ProfilesService: rotas por id (so o dono)', () => {
  const repo = () => ({ findOne: jest.fn(), create: jest.fn((value) => value), save: jest.fn(async (value) => ({ id: 10, ...value })), delete: jest.fn() });
  const dna = repo();
  const trips = repo();
  const users = { update: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new ProfilesService(dna as never, trips as never, users as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    dna.findOne.mockReset();
    trips.findOne.mockReset();
  });

  it('busca por id sempre filtra pelo dono e responde 404 para perfil de outro usuario', async () => {
    dna.findOne.mockResolvedValue(null);
    await expect(service.findOwnedDna(3, 50)).rejects.toThrow(new NotFoundException('Perfil de viajante nao encontrado.'));
    expect(dna.findOne).toHaveBeenCalledWith({ where: { id: 50, user: { id: 3 } } });
    trips.findOne.mockResolvedValue(null);
    await expect(service.findOwnedTripPreference(3, 51)).rejects.toThrow('Preferencias de viagem nao encontradas.');
    expect(trips.findOne).toHaveBeenCalledWith({ where: { id: 51, user: { id: 3 } } });
  });

  it('POST cria e audita traveler-dna.created; com perfil existente responde 409', async () => {
    dna.findOne.mockResolvedValue(null);
    await service.createDna(3, DNA);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'traveler-dna.created', actor_id: 3 }));

    dna.findOne.mockResolvedValue({ id: 10 });
    await expect(service.createDna(3, DNA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('PUT/PATCH por id de outro usuario nao grava nada', async () => {
    dna.findOne.mockResolvedValue(null);
    await expect(service.updateOwnedDna(3, 99, { pace: 'fast' })).rejects.toBeInstanceOf(NotFoundException);
    expect(dna.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('PATCH por id do dono atualiza e audita trip-preferences.updated', async () => {
    trips.findOne.mockResolvedValue({ id: 20, budget_min: '100.00', budget_max: '200.00' });
    await service.updateOwnedTripPreference(3, 20, { budget_max: 300 });
    expect(trips.save).toHaveBeenCalledWith(expect.objectContaining({ budget_max: '300', budget_min: '100.00' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'trip-preferences.updated', actor_id: 3 }));
  });

  it('DELETE remove, marca o perfil como incompleto e audita', async () => {
    dna.findOne.mockResolvedValue({ id: 10 });
    await service.removeOwnedDna(3, 10);
    expect(dna.delete).toHaveBeenCalledWith({ id: 10 });
    expect(users.update).toHaveBeenCalledWith({ id: 3, is_profile_complete: true }, { is_profile_complete: false });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'traveler-dna.deleted', object_id: '10' }));
  });
});
