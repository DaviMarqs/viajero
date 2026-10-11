import { NotFoundException } from '@nestjs/common';
import { ItinerariesService } from '../itineraries.service';

describe('removeFavorite', () => {
  const favorites = { findOne: jest.fn(), delete: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new ItinerariesService({} as never, {} as never, favorites as never, {} as never, {} as never, {} as never, audit as never);
  beforeEach(() => jest.resetAllMocks());

  it('removes only the authenticated user favorite and records the action', async () => {
    favorites.findOne.mockResolvedValue({ id: 7, itinerary: { id: 12 } });
    await service.removeFavorite(3, 7);
    expect(favorites.findOne).toHaveBeenCalledWith({ where: { id: 7, user: { id: 3 } }, relations: { itinerary: true } });
    expect(favorites.delete).toHaveBeenCalledWith({ id: 7, user: { id: 3 } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'itinerary.unfavorited', actor_id: 3, object_id: '12' }));
  });

  it('does not delete another user favorite or a missing favorite', async () => {
    favorites.findOne.mockResolvedValue(null);
    await expect(service.removeFavorite(3, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(favorites.delete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
