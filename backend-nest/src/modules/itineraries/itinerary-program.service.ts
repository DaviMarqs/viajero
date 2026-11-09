import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Itinerary, ItineraryDailyEvent, ItineraryDay } from './entities';
import { PointOfInterest } from '../destinations/entities';
import { AuditService } from '../audit/audit.service';
import { ItinerariesService } from './itineraries.service';
import {
  applyProgramLayout,
  buildProgramSnapshot,
  planProgramRestore,
  popProgramSnapshot,
  ProgramLayout,
  pushProgramSnapshot,
  readProgramHistory,
} from './itinerary-program';

// jsonb livre: o tipo do update do TypeORM nao aceita Record<string, unknown> direto.
const asMetadata = (metadata: Record<string, unknown>) => metadata as QueryDeepPartialEntity<Itinerary['metadata']>;

/**
 * Edicao da programacao no servidor (#50): aplica o layout enviado pelo front e desfaz pelo historico
 * (Memento em `metadata.program_history`). Cada operacao roda numa transacao com o roteiro travado,
 * entao duas edicoes simultaneas do mesmo roteiro nao se misturam.
 */
@Injectable()
export class ItineraryProgramService {
  constructor(
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    private readonly itineraryQueries: ItinerariesService,
    private readonly audit: AuditService,
  ) {}

  async updateProgram(id: number, userId: number, layout: ProgramLayout): Promise<Itinerary> {
    await this.itineraryQueries.findForUser(id, userId);
    const summary = await this.itineraries.manager.transaction(async (manager) => {
      const { itinerary, days } = await this.lockProgram(manager, id);
      const change = applyProgramLayout(days, layout);
      const metadata = pushProgramSnapshot(itinerary.metadata, buildProgramSnapshot(itinerary, days));

      // As FKs do Django sao NO ACTION, mas nada referencia eventos: podem sair direto.
      if (change.removed_event_ids.length > 0) await manager.delete(ItineraryDailyEvent, change.removed_event_ids);
      for (const event of change.events) {
        await manager.update(
          ItineraryDailyEvent,
          { id: event.id },
          { itinerary_day: { id: event.day_id }, order_index: event.order_index, start_time: event.start_time, end_time: event.end_time },
        );
      }
      for (const day of change.days) await manager.update(ItineraryDay, { id: day.id }, { estimated_cost: day.estimated_cost });
      await manager.update(Itinerary, { id }, { budget_total: change.budget_total, metadata: asMetadata(metadata) });
      return { removed_events: change.removed_event_ids.length, history_size: readProgramHistory(metadata).length };
    });
    await this.audit.log({ event_type: 'itinerary.program_updated', actor_id: userId, content_type: 'Itinerary', object_id: String(id), metadata: summary });
    return this.itineraryQueries.findForUser(id, userId);
  }

  async undoProgram(id: number, userId: number): Promise<Itinerary> {
    await this.itineraryQueries.findForUser(id, userId);
    const summary = await this.itineraries.manager.transaction(async (manager) => {
      const { itinerary, days } = await this.lockProgram(manager, id);
      const popped = popProgramSnapshot(itinerary.metadata);
      if (!popped) throw new ConflictException('Nao ha alteracoes para desfazer.');
      const plan = planProgramRestore(days, popped.snapshot);
      const pois = await this.existingPoiIds(manager, [...plan.updates, ...plan.creates].map((event) => event.fields.poi_id));
      const poiFor = (poiId: number | null) => (poiId !== null && pois.has(poiId) ? { id: poiId } : null);

      if (plan.deletes.length > 0) await manager.delete(ItineraryDailyEvent, plan.deletes);
      for (const { id: eventId, day_id, fields } of plan.updates) {
        const { poi_id, ...values } = fields;
        await manager.update(ItineraryDailyEvent, { id: eventId }, { ...values, itinerary_day: { id: day_id }, poi: poiFor(poi_id) });
      }
      for (const { day_id, fields } of plan.creates) {
        const { poi_id, ...values } = fields;
        await manager.save(manager.create(ItineraryDailyEvent, { ...values, itinerary_day: { id: day_id } as ItineraryDay, poi: poiFor(poi_id) }));
      }
      for (const day of plan.days) {
        await manager.update(ItineraryDay, { id: day.id }, { title: day.title, summary: day.summary, estimated_cost: day.estimated_cost });
      }
      await manager.update(Itinerary, { id }, { ...plan.itinerary, metadata: asMetadata(popped.metadata) });
      return {
        restored_events: plan.updates.length,
        recreated_events: plan.creates.length,
        removed_events: plan.deletes.length,
        history_size: readProgramHistory(popped.metadata).length,
      };
    });
    await this.audit.log({ event_type: 'itinerary.program_undone', actor_id: userId, content_type: 'Itinerary', object_id: String(id), metadata: summary });
    return this.itineraryQueries.findForUser(id, userId);
  }

  /** Trava a linha do roteiro ate o fim da transacao e carrega a programacao atual. */
  private async lockProgram(manager: EntityManager, id: number): Promise<{ itinerary: Itinerary; days: ItineraryDay[] }> {
    const itinerary = await manager.findOne(Itinerary, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!itinerary) throw new NotFoundException('Roteiro nao encontrado.');
    if (itinerary.generation_status !== 'ready') {
      throw new ConflictException('A programacao so pode ser editada com o roteiro pronto.');
    }
    const days = await manager.find(ItineraryDay, {
      where: { itinerary: { id } },
      relations: { events: { poi: true } },
      order: { day_number: 'ASC', events: { order_index: 'ASC', id: 'ASC' } },
    });
    return { itinerary, days };
  }

  /** POIs apagados depois do snapshot nao podem voltar como FK: o evento volta sem POI. */
  private async existingPoiIds(manager: EntityManager, ids: Array<number | null>): Promise<Set<number>> {
    const wanted = [...new Set(ids.filter((id): id is number => id !== null))];
    if (wanted.length === 0) return new Set();
    const found = await manager.find(PointOfInterest, { select: { id: true }, where: { id: In(wanted) } });
    return new Set(found.map((poi) => Number(poi.id)));
  }
}
