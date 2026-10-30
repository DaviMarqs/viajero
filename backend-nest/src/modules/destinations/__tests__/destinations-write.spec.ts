import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DestinationsService } from '../destinations.service';
import { Destination, DestinationCostProfile, PointOfInterest } from '../entities';
import { Itinerary, ItineraryDailyEvent } from '../../itineraries/entities';
import { LlmJob } from '../../ai/entities';

type Target = { name: string };

function fakeManager(rows: Map<Target, Array<{ id: number }>>) {
  const calls: string[] = [];
  const builder = {
    delete: () => builder,
    from: (table: string) => {
      calls.push(`delete ${table}`);
      return builder;
    },
    where: () => builder,
    execute: async () => undefined,
  };
  const manager = {
    find: jest.fn(async (entity: Target) => rows.get(entity) ?? []),
    delete: jest.fn(async (entity: Target, ids: number | number[]) => {
      calls.push(`delete ${entity.name} ${[ids].flat().join(',')}`);
    }),
    update: jest.fn(async (entity: Target, ids: number[], values: Record<string, unknown>) => {
      calls.push(`update ${entity.name} ${ids.join(',')} ${JSON.stringify(values)}`);
    }),
    createQueryBuilder: () => builder,
  };
  return { manager: manager as unknown as EntityManager, calls };
}

describe('DestinationsService: escrita (staff)', () => {
  const destinations = { findOne: jest.fn(), exists: jest.fn(), update: jest.fn(), manager: { transaction: jest.fn() } };
  const pois = { findOne: jest.fn(), exists: jest.fn(), update: jest.fn(), save: jest.fn(), create: jest.fn((value) => value), manager: { transaction: jest.fn() } };
  const audit = { log: jest.fn() };
  const service = new DestinationsService(destinations as never, pois as never, audit as never);

  beforeEach(() => {
    jest.resetAllMocks();
    pois.create.mockImplementation((value) => value);
  });

  describe('updateDestination', () => {
    it('destino inexistente responde 404', async () => {
      destinations.findOne.mockResolvedValue(null);
      await expect(service.updateDestination(9, { name: 'X' }, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('slug de outro destino responde 400 sem gravar', async () => {
      destinations.findOne.mockResolvedValue({ id: 9, slug: 'lisboa' });
      destinations.exists.mockResolvedValue(true);
      await expect(service.updateDestination(9, { slug: 'porto' }, 1)).rejects.toThrow('Ja existe um destino com este slug.');
      expect(destinations.update).not.toHaveBeenCalled();
    });

    it('grava so os campos enviados, com nota em decimal, e audita', async () => {
      destinations.findOne.mockResolvedValueOnce({ id: 9, slug: 'lisboa' }).mockResolvedValueOnce({ id: 9, slug: 'lisboa', name: 'Lisboa' });
      await service.updateDestination(9, { name: 'Lisboa', average_rating: 4.5, city: undefined }, 7);
      expect(destinations.exists).not.toHaveBeenCalled();
      expect(destinations.update).toHaveBeenCalledWith({ id: 9 }, { name: 'Lisboa', average_rating: '4.50' });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'destination.updated', actor_id: 7, metadata: { fields: ['name', 'average_rating'] } }));
    });
  });

  describe('removeDestination', () => {
    it('apaga roteiros (com dependentes), POIs, custo e solta jobs, nessa ordem', async () => {
      destinations.findOne.mockResolvedValue({ id: 9, slug: 'lisboa', name: 'Lisboa' });
      const { manager, calls } = fakeManager(
        new Map<Target, Array<{ id: number }>>([
          [Itinerary, [{ id: 3 }]],
          [PointOfInterest, [{ id: 40 }, { id: 41 }]],
          [ItineraryDailyEvent, [{ id: 500 }]],
          [DestinationCostProfile, [{ id: 60 }]],
          [LlmJob, [{ id: 70 }]],
        ]),
      );
      destinations.manager.transaction.mockImplementation((work: (m: EntityManager) => Promise<unknown>) => work(manager));

      await service.removeDestination(9, 1);

      // Os eventos de outros roteiros que usam os POIs ficam sem POI; o roteiro do destino sai inteiro antes.
      expect(calls.indexOf('delete Itinerary 3')).toBeLessThan(calls.indexOf('update ItineraryDailyEvent 500 {"poi":null}'));
      expect(calls.slice(calls.indexOf('update ItineraryDailyEvent 500 {"poi":null}'))).toEqual([
        'update ItineraryDailyEvent 500 {"poi":null}',
        'delete destinations_pointofinterest_tags',
        'delete PointOfInterest 40,41',
        'delete DestinationCostProfile 60',
        'update LlmJob 70 {"destination":null}',
        `delete ${Destination.name} 9`,
      ]);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'destination.deleted', metadata: expect.objectContaining({ removed_itineraries: 1, removed_pois: 2 }) }));
    });

    it('destino inexistente responde 404 sem abrir transacao', async () => {
      destinations.findOne.mockResolvedValue(null);
      await expect(service.removeDestination(9, 1)).rejects.toThrow('Destino nao encontrado.');
      expect(destinations.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('POIs', () => {
    const dto = { destination: 9, name: 'Museu', slug: 'museu', poi_type: 'attraction', rating: 4.2 };

    it('criar exige destino existente e slug livre no destino', async () => {
      destinations.exists.mockResolvedValue(false);
      await expect(service.createPoi(dto, 1)).rejects.toThrow('Destino nao encontrado.');
      destinations.exists.mockResolvedValue(true);
      pois.exists.mockResolvedValue(true);
      await expect(service.createPoi(dto, 1)).rejects.toBeInstanceOf(BadRequestException);
      expect(pois.save).not.toHaveBeenCalled();
    });

    it('criar grava rating em decimal e liga o destino', async () => {
      destinations.exists.mockResolvedValue(true);
      pois.exists.mockResolvedValue(false);
      pois.save.mockResolvedValue({ id: 50 });
      pois.findOne.mockResolvedValue({ id: 50 });
      await service.createPoi(dto, 1);
      expect(pois.save).toHaveBeenCalledWith({ name: 'Museu', slug: 'museu', poi_type: 'attraction', rating: '4.20', destination: { id: 9 } });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'poi.created', object_id: '50' }));
    });

    it('mudar o slug confere duplicidade no destino atual ignorando o proprio POI', async () => {
      pois.findOne.mockResolvedValue({ id: 50, slug: 'museu', destination: { id: '9' } });
      pois.exists.mockResolvedValue(false);
      await service.updatePoi(50, { slug: 'museu-novo' }, 1);
      expect(pois.exists).toHaveBeenCalledWith({ where: expect.objectContaining({ destination: { id: 9 }, slug: 'museu-novo' }) });
      expect(pois.update).toHaveBeenCalledWith({ id: 50 }, { slug: 'museu-novo' });
    });

    it('POI inexistente responde 404', async () => {
      pois.findOne.mockResolvedValue(null);
      await expect(service.findPoi(1)).rejects.toThrow('Ponto de interesse nao encontrado.');
      await expect(service.removePoi(1, 1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
