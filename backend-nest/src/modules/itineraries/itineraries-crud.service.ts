import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Itinerary } from './entities';
import { Destination } from '../destinations/entities';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { AuditService } from '../audit/audit.service';
import { requireTripParameters } from './trip-generation-context';
import { deleteItinerariesCascade } from './itinerary-removal';
import { ListQueryOptions, orderByIds, PaginatedList, parseListQuery, runListQuery } from '../../common/query/list-query';
import { ListRequestContext } from '../../common/query/list-request.decorator';

/** Mesmos campos do ItineraryViewSet do Django. */
export const ITINERARY_LIST_OPTIONS: ListQueryOptions = {
  filters: { destination: { column: 'destination_id', type: 'int' }, generation_status: { column: 'generation_status' } },
  searchFields: ['title', 'summary'],
  orderingFields: ['created_at', 'budget_total', 'duration_days'],
  defaultOrdering: ['-created_at'],
};

/** Campos do PUT que seguem as regras do PATCH; os ausentes nao entram (ficam como estao). */
export function replaceableFields(dto: CreateItineraryDto): UpdateItineraryDto {
  const fields: UpdateItineraryDto = {
    title: dto.title,
    summary: dto.summary,
    start_date: dto.start_date,
    end_date: dto.end_date,
    duration_days: dto.duration_days,
    budget_total: dto.budget_total,
    currency_code: dto.currency_code,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as UpdateItineraryDto;
}

/** Paridade com o Django: lista com filtros, PUT e DELETE do roteiro do proprio usuario. */
@Injectable()
export class ItinerariesCrudService {
  constructor(
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    private readonly service: ItinerariesService,
    private readonly audit: AuditService,
  ) {}

  /** Sem `page` devolve o array completo, como antes; as relacoes sao as mesmas da lista original. */
  list(userId: number, request: ListRequestContext): Promise<Itinerary[] | PaginatedList<Itinerary>> {
    return runListQuery({
      qb: this.itineraries.createQueryBuilder('itinerary').where('"itinerary"."user_id" = :userId', { userId }),
      query: parseListQuery(request.query, ITINERARY_LIST_OPTIONS),
      options: ITINERARY_LIST_OPTIONS,
      url: request.url,
      present: async (rows) => {
        const ids = rows.map((row) => row.id);
        if (!ids.length) return [];
        const loaded = await this.itineraries.find({
          where: { id: In(ids) },
          relations: { destination: true, days: { events: true }, review_stats: true },
        });
        return orderByIds(loaded, ids);
      },
    });
  }

  /**
   * PUT: corpo validado como no POST (destino obrigatorio). Campos opcionais ausentes ficam como estao,
   * igual ao PUT do DRF. Titulo, datas, duracao e custos passam pelo `update` do PATCH (mesmas regras).
   */
  async replace(id: number, userId: number, dto: CreateItineraryDto): Promise<Itinerary> {
    const current = await this.service.findForUser(id, userId);
    const destination = await this.destinations.findOne({ where: { id: dto.destination } });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    const parameters = dto.trip_preferences ? requireTripParameters(dto.trip_preferences) : null;

    await this.service.update(id, userId, replaceableFields(dto));

    const changes: QueryDeepPartialEntity<Itinerary> = {};
    if (Number(current.destination.id) !== Number(destination.id)) changes.destination = { id: destination.id };
    if (parameters) {
      // Relido depois do update, que tambem grava metadata.
      const latest = await this.itineraries.findOne({ where: { id }, select: { id: true, metadata: true } });
      changes.metadata = { ...(latest?.metadata ?? {}), trip_preferences: { ...parameters }, trip_parameters_confirmed: true };
    }
    if (Object.keys(changes).length > 0) await this.itineraries.update({ id }, changes);
    return this.service.findForUser(id, userId);
  }

  async remove(id: number, userId: number): Promise<void> {
    const itinerary = await this.itineraries.findOne({ where: { id, user: { id: userId } }, select: { id: true, title: true } });
    if (!itinerary) throw new NotFoundException('Roteiro nao encontrado.');
    await this.itineraries.manager.transaction((manager) => deleteItinerariesCascade(manager, [Number(itinerary.id)]));
    await this.audit.log({ event_type: 'itinerary.deleted', actor_id: userId, content_type: 'Itinerary', object_id: String(itinerary.id), metadata: { title: itinerary.title } });
  }
}
