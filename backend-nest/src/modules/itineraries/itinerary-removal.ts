import { EntityManager, EntityTarget, FindOptionsSelect, FindOptionsWhere, In } from 'typeorm';
import { FavoriteItinerary, Itinerary, ItineraryDailyEvent, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { LlmJob } from '../ai/entities';

async function idsOf<T extends { id: number }>(manager: EntityManager, entity: EntityTarget<T>, where: FindOptionsWhere<T>): Promise<number[]> {
  const rows = await manager.find(entity, { select: { id: true } as FindOptionsSelect<T>, where });
  return rows.map((row) => row.id);
}

async function deleteWhere<T extends { id: number }>(manager: EntityManager, entity: EntityTarget<T>, where: FindOptionsWhere<T>): Promise<void> {
  const ids = await idsOf(manager, entity, where);
  if (ids.length) await manager.delete(entity, ids);
}

/**
 * Apaga roteiros e dependentes. As FKs criadas pelo Django sao NO ACTION no banco (o CASCADE era feito pelo ORM),
 * entao a ordem e: eventos -> dias -> favoritos -> avaliacoes -> estatistica -> links; os jobs de IA ficam com
 * `itinerary_id` nulo (SET_NULL no Django). Chame dentro de uma transacao.
 */
export async function deleteItinerariesCascade(manager: EntityManager, itineraryIds: number[]): Promise<void> {
  if (!itineraryIds.length) return;
  const ofItineraries = { itinerary: { id: In(itineraryIds) } };

  const dayIds = await idsOf(manager, ItineraryDay, ofItineraries);
  if (dayIds.length) {
    await deleteWhere(manager, ItineraryDailyEvent, { itinerary_day: { id: In(dayIds) } });
    await manager.delete(ItineraryDay, dayIds);
  }
  await deleteWhere(manager, FavoriteItinerary, ofItineraries);
  await deleteWhere(manager, Review, ofItineraries);
  await deleteWhere(manager, ReviewStat, ofItineraries);
  await deleteWhere(manager, SharedItineraryLink, ofItineraries);

  const jobIds = await idsOf(manager, LlmJob, ofItineraries);
  if (jobIds.length) await manager.update(LlmJob, jobIds, { itinerary: null });

  await manager.delete(Itinerary, itineraryIds);
}
