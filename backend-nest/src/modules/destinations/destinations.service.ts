import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Destination, DestinationCostProfile, PointOfInterest } from './entities';
import { Itinerary, ItineraryDailyEvent } from '../itineraries/entities';
import { LlmJob } from '../ai/entities';
import { matchesDestinationQuery, normalizeDestinationText, portugueseCountry, portuguesePlaceName } from './destination-language';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/destination-write.dto';
import { CreatePoiDto, UpdatePoiDto } from './dto/poi-write.dto';
import { AuditService } from '../audit/audit.service';
import { deleteItinerariesCascade } from '../itineraries/itinerary-removal';
import { ListQueryOptions, orderByIds, PaginatedList, parseListQuery, runListQuery } from '../../common/query/list-query';
import { ListRequestContext } from '../../common/query/list-request.decorator';

const LIST_LIMIT = 100;
const POI_TAGS_TABLE = 'destinations_pointofinterest_tags';

/** Mesmos campos do DestinationViewSet do Django. */
export const DESTINATION_LIST_OPTIONS: ListQueryOptions = {
  filters: { country: { column: 'country' }, city: { column: 'city' } },
  searchFields: ['name', 'country', 'city', 'summary'],
  orderingFields: ['name', 'average_rating', 'created_at'],
  defaultOrdering: ['name'],
};

/** Mesmos campos do PointOfInterestViewSet do Django (`tags__slug` filtra pela tabela M2M). */
export const POI_LIST_OPTIONS: ListQueryOptions = {
  filters: {
    destination: { column: 'destination_id', type: 'int' },
    poi_type: { column: 'poi_type' },
    tags__slug: {
      condition: ({ column, param }) =>
        `${column('id')} IN (SELECT poi_tags.pointofinterest_id FROM ${POI_TAGS_TABLE} poi_tags ` +
        `INNER JOIN destinations_poitag tag ON tag.id = poi_tags.poitag_id WHERE tag.slug = :${param})`,
    },
  },
  searchFields: ['name', 'summary', 'address'],
  orderingFields: ['name', 'rating', 'estimated_visit_minutes'],
  defaultOrdering: ['name'],
};

function slugTaken(message: string): BadRequestException {
  return new BadRequestException({ message, errors: { slug: [message] } });
}

/** Tira chaves ausentes e converte decimais para o formato das colunas. */
function definedChanges<T extends object>(dto: T, decimals: string[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, decimals.includes(key) && typeof value === 'number' ? value.toFixed(2) : value]),
  );
}

/** POI sai do banco sem deixar orfaos: eventos ficam sem POI (SET_NULL) e as tags M2M saem. */
async function deletePoisCascade(manager: EntityManager, poiIds: number[]): Promise<void> {
  if (!poiIds.length) return;
  const events = await manager.find(ItineraryDailyEvent, { select: { id: true }, where: { poi: { id: In(poiIds) } } });
  if (events.length) await manager.update(ItineraryDailyEvent, events.map((event) => event.id), { poi: null });
  await manager.createQueryBuilder().delete().from(POI_TAGS_TABLE).where('pointofinterest_id IN (:...poiIds)', { poiIds }).execute();
  await manager.delete(PointOfInterest, poiIds);
}

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(PointOfInterest) private readonly pois: Repository<PointOfInterest>,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<Destination[]> {
    return this.destinations.find({
      relations: { cost_profile: true, pois: { tags: true } },
      order: { name: 'ASC' },
      take: 100,
    });
  }

  async findOne(id: number): Promise<Destination> {
    const destination = await this.destinations.findOne({
      where: { id },
      relations: { cost_profile: true, pois: { tags: true } },
    });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    return destination;
  }

  findBySlug(slug: string): Promise<Destination | null> {
    return this.destinations.findOne({ where: { slug }, relations: { cost_profile: true, pois: { tags: true } } });
  }

  async search(input: { q?: string; country?: string; city?: string }): Promise<Destination[]> {
    // Search original names and Portuguese aliases without accents; never create duplicate cities for a translated query.
    let results = await this.destinations.find({
      relations: { cost_profile: true, pois: { tags: true } },
      order: { average_rating: 'DESC', name: 'ASC' },
    });
    if (input.q?.trim()) results = results.filter(item => matchesDestinationQuery(item, input.q!));
    if (input.country) results = results.filter(item => normalizeDestinationText(portugueseCountry(item.country)) === normalizeDestinationText(portugueseCountry(input.country!)));
    if (input.city) results = results.filter(item => normalizeDestinationText(portuguesePlaceName(item.city)) === normalizeDestinationText(portuguesePlaceName(input.city!)));
    return results.slice(0, 20);
  }

  create(dto: CreateDestinationDto, userId?: number): Promise<Destination> {
    const destination = this.destinations.create({
      ...dto,
      city: dto.city ?? '',
      summary: dto.summary ?? '',
      hero_image_url: dto.hero_image_url ?? '',
      country: dto.country || 'Desconhecido',
      created_by: userId ? ({ id: userId } as never) : null,
    });
    return this.destinations.save(destination);
  }

  /** GET /api/destinations com busca, filtros e ordenacao do Django; sem `page` segue o array de ate 100 itens. */
  listWithQuery(request: ListRequestContext): Promise<Destination[] | PaginatedList<Destination>> {
    return runListQuery({
      qb: this.destinations.createQueryBuilder('destination'),
      query: parseListQuery(request.query, DESTINATION_LIST_OPTIONS),
      options: DESTINATION_LIST_OPTIONS,
      url: request.url,
      unpaginatedLimit: LIST_LIMIT,
      present: async (rows) => {
        const ids = rows.map((row) => row.id);
        if (!ids.length) return [];
        return orderByIds(await this.destinations.find({ where: { id: In(ids) }, relations: { cost_profile: true, pois: { tags: true } } }), ids);
      },
    });
  }

  /** PUT/PATCH (staff). Slug continua unico. */
  async updateDestination(id: number, dto: UpdateDestinationDto, actorId: number): Promise<Destination> {
    const destination = await this.destinations.findOne({ where: { id } });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    if (dto.slug !== undefined && dto.slug !== destination.slug && (await this.destinations.exists({ where: { slug: dto.slug, id: Not(id) } }))) {
      throw slugTaken('Ja existe um destino com este slug.');
    }
    const changes = definedChanges(dto, ['average_rating']);
    if (Object.keys(changes).length > 0) await this.destinations.update({ id }, changes as QueryDeepPartialEntity<Destination>);
    await this.audit.log({ event_type: 'destination.updated', actor_id: actorId, content_type: 'Destination', object_id: String(id), metadata: { fields: Object.keys(changes) } });
    return this.findOne(id);
  }

  /**
   * DELETE (staff). Como o CASCADE do Django: leva custo, POIs e os roteiros do destino (com dependentes);
   * jobs de IA ficam sem destino. As FKs do banco sao NO ACTION, entao tudo sai em ordem numa transacao.
   */
  async removeDestination(id: number, actorId: number): Promise<void> {
    const destination = await this.destinations.findOne({ where: { id }, select: { id: true, slug: true, name: true } });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    const removed = await this.destinations.manager.transaction(async (manager) => {
      const itineraries = await manager.find(Itinerary, { select: { id: true }, where: { destination: { id } } });
      await deleteItinerariesCascade(manager, itineraries.map((itinerary) => itinerary.id));
      const pois = await manager.find(PointOfInterest, { select: { id: true }, where: { destination: { id } } });
      await deletePoisCascade(manager, pois.map((poi) => poi.id));
      const profiles = await manager.find(DestinationCostProfile, { select: { id: true }, where: { destination: { id } } });
      if (profiles.length) await manager.delete(DestinationCostProfile, profiles.map((profile) => profile.id));
      const jobs = await manager.find(LlmJob, { select: { id: true }, where: { destination: { id } } });
      if (jobs.length) await manager.update(LlmJob, jobs.map((job) => job.id), { destination: null });
      await manager.delete(Destination, id);
      return { itineraries: itineraries.length, pois: pois.length };
    });
    await this.audit.log({
      event_type: 'destination.deleted',
      actor_id: actorId,
      content_type: 'Destination',
      object_id: String(id),
      metadata: { slug: destination.slug, name: destination.name, removed_itineraries: removed.itineraries, removed_pois: removed.pois },
    });
  }

  /** GET /api/pois (publico) com os filtros do Django; sem `page` segue o array de ate 100 itens. */
  listPoisWithQuery(request: ListRequestContext): Promise<PointOfInterest[] | PaginatedList<PointOfInterest>> {
    return runListQuery({
      qb: this.pois.createQueryBuilder('poi'),
      query: parseListQuery(request.query, POI_LIST_OPTIONS),
      options: POI_LIST_OPTIONS,
      url: request.url,
      unpaginatedLimit: LIST_LIMIT,
      present: async (rows) => {
        const ids = rows.map((row) => row.id);
        if (!ids.length) return [];
        return orderByIds(await this.pois.find({ where: { id: In(ids) }, relations: { tags: true, destination: true } }), ids);
      },
    });
  }

  /** Mesmo formato dos itens da lista (com tags e destino). */
  async findPoi(id: number): Promise<PointOfInterest> {
    const poi = await this.pois.findOne({ where: { id }, relations: { tags: true, destination: true } });
    if (!poi) throw new NotFoundException('Ponto de interesse nao encontrado.');
    return poi;
  }

  async createPoi(dto: CreatePoiDto, actorId: number): Promise<PointOfInterest> {
    await this.requireDestination(dto.destination);
    await this.assertPoiSlugAvailable(dto.destination, dto.slug);
    const { destination, ...fields } = definedChanges(dto, ['rating']) as Record<string, unknown> & { destination: number };
    const saved = await this.pois.save(this.pois.create({ ...fields, destination: { id: destination } as never }));
    await this.audit.log({ event_type: 'poi.created', actor_id: actorId, content_type: 'PointOfInterest', object_id: String(saved.id), metadata: { destination_id: destination } });
    return this.findPoi(saved.id);
  }

  /** PUT/PATCH (staff). Slug unico por destino; tags continuam somente leitura, como no Django. */
  async updatePoi(id: number, dto: UpdatePoiDto, actorId: number): Promise<PointOfInterest> {
    const poi = await this.findPoi(id);
    const destinationId = dto.destination ?? Number(poi.destination.id);
    if (dto.destination !== undefined && dto.destination !== Number(poi.destination.id)) await this.requireDestination(dto.destination);
    if (dto.slug !== undefined || dto.destination !== undefined) await this.assertPoiSlugAvailable(destinationId, dto.slug ?? poi.slug, id);
    const { destination, ...fields } = definedChanges(dto, ['rating']) as Record<string, unknown> & { destination?: number };
    const changes = { ...fields, ...(destination !== undefined ? { destination: { id: destination } } : {}) };
    if (Object.keys(changes).length > 0) await this.pois.update({ id }, changes as QueryDeepPartialEntity<PointOfInterest>);
    await this.audit.log({ event_type: 'poi.updated', actor_id: actorId, content_type: 'PointOfInterest', object_id: String(id), metadata: { fields: Object.keys(changes) } });
    return this.findPoi(id);
  }

  async removePoi(id: number, actorId: number): Promise<void> {
    const poi = await this.findPoi(id);
    await this.pois.manager.transaction((manager) => deletePoisCascade(manager, [Number(poi.id)]));
    await this.audit.log({ event_type: 'poi.deleted', actor_id: actorId, content_type: 'PointOfInterest', object_id: String(id), metadata: { slug: poi.slug, destination_id: Number(poi.destination.id) } });
  }

  private async requireDestination(id: number): Promise<void> {
    if (!(await this.destinations.exists({ where: { id } }))) throw new NotFoundException('Destino nao encontrado.');
  }

  private async assertPoiSlugAvailable(destinationId: number, slug: string, exceptId?: number): Promise<void> {
    const taken = await this.pois.exists({
      where: { destination: { id: destinationId }, slug, ...(exceptId !== undefined ? { id: Not(exceptId) } : {}) },
    });
    if (taken) throw slugTaken('Ja existe um ponto de interesse com este slug neste destino.');
  }
}
