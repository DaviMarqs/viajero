import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItinerariesCrudService, replaceableFields } from '../itineraries-crud.service';

const TRIP = {
  budget_min: 1000, budget_max: 3000, currency_code: 'BRL', companionship: 'couple', preferred_trip_length_days: 3, travel_month: 'maio',
  hotel_level: 'mid', transportation_style: 'public', dietary_preferences: [], accessibility_needs: [], interests: ['culture'],
};

describe('ItinerariesCrudService', () => {
  const itineraries = { findOne: jest.fn(), update: jest.fn(), manager: { transaction: jest.fn() } };
  const destinations = { findOne: jest.fn() };
  const service = { findForUser: jest.fn(), update: jest.fn() };
  const audit = { log: jest.fn() };
  const crud = new ItinerariesCrudService(itineraries as never, destinations as never, service as never, audit as never);

  beforeEach(() => {
    jest.resetAllMocks();
    service.findForUser.mockResolvedValue({ id: 5, destination: { id: 1 }, metadata: {} });
    destinations.findOne.mockResolvedValue({ id: 1, name: 'Lisboa' });
  });

  describe('replaceableFields', () => {
    it('leva so os campos enviados para o update do PATCH', () => {
      expect(replaceableFields({ destination: 1, title: 'Novo', duration_days: 3 })).toEqual({ title: 'Novo', duration_days: 3 });
      expect(replaceableFields({ destination: 1 })).toEqual({});
    });
  });

  describe('replace (PUT)', () => {
    it('roteiro de outro usuario responde 404 antes de qualquer gravacao', async () => {
      service.findForUser.mockRejectedValue(new NotFoundException('Roteiro nao encontrado.'));
      await expect(crud.replace(5, 2, { destination: 1 })).rejects.toBeInstanceOf(NotFoundException);
      expect(service.update).not.toHaveBeenCalled();
      expect(itineraries.update).not.toHaveBeenCalled();
    });

    it('destino inexistente ou parametros invalidos respondem antes de gravar', async () => {
      destinations.findOne.mockResolvedValue(null);
      await expect(crud.replace(5, 1, { destination: 99 })).rejects.toThrow('Destino nao encontrado.');
      destinations.findOne.mockResolvedValue({ id: 1 });
      await expect(crud.replace(5, 1, { destination: 1, trip_preferences: { ...TRIP, interests: [] } as never })).rejects.toBeInstanceOf(BadRequestException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('aplica as regras do PATCH e troca destino e parametros da viagem', async () => {
      itineraries.findOne.mockResolvedValue({ id: 5, metadata: { title_customized: true } });
      destinations.findOne.mockResolvedValue({ id: '2' });
      await crud.replace(5, 1, { destination: 2, title: 'Novo', start_date: '2026-05-01', trip_preferences: TRIP as never });
      expect(service.update).toHaveBeenCalledWith(5, 1, { title: 'Novo', start_date: '2026-05-01' });
      expect(itineraries.update).toHaveBeenCalledWith({ id: 5 }, {
        destination: { id: '2' },
        metadata: expect.objectContaining({ title_customized: true, trip_parameters_confirmed: true, trip_preferences: expect.objectContaining({ interests: ['culture'] }) }),
      });
      // As regras do PATCH (datas, duracao, snapshot) rodam antes da troca de destino.
      expect(service.update.mock.invocationCallOrder[0]).toBeLessThan(itineraries.update.mock.invocationCallOrder[0]);
      expect(service.findForUser).toHaveBeenLastCalledWith(5, 1);
    });

    it('mesmo destino e sem parametros nao faz update extra', async () => {
      await crud.replace(5, 1, { destination: 1, title: 'X' });
      expect(service.update).toHaveBeenCalledWith(5, 1, { title: 'X' });
      expect(itineraries.update).not.toHaveBeenCalled();
    });
  });

  describe('remove (DELETE)', () => {
    it('so o dono apaga: o filtro inclui o usuario', async () => {
      itineraries.findOne.mockResolvedValue(null);
      await expect(crud.remove(5, 2)).rejects.toThrow('Roteiro nao encontrado.');
      expect(itineraries.findOne).toHaveBeenCalledWith({ where: { id: 5, user: { id: 2 } }, select: { id: true, title: true } });
      expect(itineraries.manager.transaction).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('apaga em transacao e audita itinerary.deleted', async () => {
      itineraries.findOne.mockResolvedValue({ id: '5', title: 'Lisboa' });
      itineraries.manager.transaction.mockResolvedValue(undefined);
      await crud.remove(5, 1);
      expect(itineraries.manager.transaction).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith({ event_type: 'itinerary.deleted', actor_id: 1, content_type: 'Itinerary', object_id: '5', metadata: { title: 'Lisboa' } });
    });
  });
});
