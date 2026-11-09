import { EntityManager } from 'typeorm';
import { FavoriteItinerary, Itinerary, ItineraryDailyEvent, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from '../entities';
import { LlmJob } from '../../ai/entities';
import { deleteItinerariesCascade } from '../itinerary-removal';

type Target = { name: string };

function fakeManager(rows: Map<Target, Array<{ id: number }>>) {
  const calls: string[] = [];
  const manager = {
    find: jest.fn(async (entity: Target) => rows.get(entity) ?? []),
    delete: jest.fn(async (entity: Target, ids: number[]) => {
      calls.push(`delete ${entity.name} ${ids.join(',')}`);
    }),
    update: jest.fn(async (entity: Target, ids: number[], values: Record<string, unknown>) => {
      calls.push(`update ${entity.name} ${ids.join(',')} ${JSON.stringify(values)}`);
    }),
  };
  return { manager: manager as unknown as EntityManager, calls, raw: manager };
}

describe('deleteItinerariesCascade', () => {
  it('apaga os dependentes na ordem das FKs NO ACTION e solta os jobs de IA', async () => {
    const { manager, calls } = fakeManager(
      new Map<Target, Array<{ id: number }>>([
        [ItineraryDay, [{ id: 11 }, { id: 12 }]],
        [ItineraryDailyEvent, [{ id: 101 }, { id: 102 }]],
        [FavoriteItinerary, [{ id: 21 }]],
        [Review, [{ id: 31 }]],
        [ReviewStat, [{ id: 41 }]],
        [SharedItineraryLink, [{ id: 51 }]],
        [LlmJob, [{ id: 61 }]],
      ]),
    );

    await deleteItinerariesCascade(manager, [7]);

    expect(calls).toEqual([
      'delete ItineraryDailyEvent 101,102',
      'delete ItineraryDay 11,12',
      'delete FavoriteItinerary 21',
      'delete Review 31',
      'delete ReviewStat 41',
      'delete SharedItineraryLink 51',
      'update LlmJob 61 {"itinerary":null}',
      'delete Itinerary 7',
    ]);
  });

  it('roteiro sem dependentes apaga so o roteiro', async () => {
    const { manager, calls } = fakeManager(new Map());
    await deleteItinerariesCascade(manager, [7, 8]);
    expect(calls).toEqual(['delete Itinerary 7,8']);
  });

  it('sem ids nao toca no banco', async () => {
    const { manager, raw } = fakeManager(new Map());
    await deleteItinerariesCascade(manager, []);
    expect(raw.find).not.toHaveBeenCalled();
    expect(raw.delete).not.toHaveBeenCalled();
  });

  it('busca os dependentes sempre pelos roteiros informados', async () => {
    const { manager, raw } = fakeManager(new Map([[ItineraryDay, [{ id: 11 }]]]));
    await deleteItinerariesCascade(manager, [7]);
    const [entity, options] = raw.find.mock.calls[0] as unknown as [Target, { where: { itinerary: { id: { _value: number[] } } } }];
    expect(entity).toBe(ItineraryDay);
    expect(options.where.itinerary.id._value).toEqual([7]);
    expect(raw.find.mock.calls.find(([target]) => target === Itinerary)).toBeUndefined();
  });
});
