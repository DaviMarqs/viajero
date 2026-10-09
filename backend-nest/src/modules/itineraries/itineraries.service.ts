import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FavoriteItinerary, Itinerary, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { Destination } from '../destinations/entities';
import { UserTripPreference } from '../profiles/entities';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateSharedLinkDto } from './dto/create-shared-link.dto';
import { AuditService } from '../audit/audit.service';
import { AuditedServiceDecorator } from '../../common/decorators/audited-service.decorator';
import { canViewItinerary, resolveItineraryDefaults } from './itinerary-rules';

const RANKING_LIMIT = 10;

function toDateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(ItineraryDay) private readonly days: Repository<ItineraryDay>,
    @InjectRepository(FavoriteItinerary) private readonly favorites: Repository<FavoriteItinerary>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewStat) private readonly reviewStats: Repository<ReviewStat>,
    @InjectRepository(SharedItineraryLink) private readonly sharedLinks: Repository<SharedItineraryLink>,
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(UserTripPreference) private readonly tripPreferences: Repository<UserTripPreference>,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: number): Promise<Itinerary[]> {
    return this.itineraries.find({
      where: { user: { id: userId } },
      relations: { destination: true, days: { events: true }, review_stats: true },
      order: { created_at: 'DESC' },
    });
  }

  async findForUser(id: number, userId: number): Promise<Itinerary> {
    const itinerary = await this.itineraries.findOne({
      where: { id, user: { id: userId } },
      relations: { destination: true, days: { events: { poi: true } }, review_stats: true },
      order: { days: { day_number: 'ASC', events: { order_index: 'ASC' } } },
    });
    if (!itinerary) throw new NotFoundException('Roteiro nao encontrado.');
    return itinerary;
  }

  /** Dono ve sempre; os demais so roteiros publicos (prontos e avaliados ou templates). */
  async findVisibleForUser(id: number, userId: number): Promise<{ itinerary: Itinerary; isOwner: boolean }> {
    const itinerary = await this.itineraries.findOne({
      where: { id },
      relations: { destination: true, days: { events: { poi: true } }, review_stats: true },
      order: { days: { day_number: 'ASC', events: { order_index: 'ASC' } } },
    });
    const isOwner = itinerary ? await this.itineraries.exists({ where: { id, user: { id: userId } } }) : false;
    if (!itinerary || !canViewItinerary(itinerary, isOwner)) throw new NotFoundException('Roteiro nao encontrado.');
    return { itinerary, isOwner };
  }

  async create(userId: number, dto: CreateItineraryDto): Promise<Itinerary> {
    const destination = await this.destinations.findOne({ where: { id: dto.destination } });
    if (!destination) throw new NotFoundException('Destino nao encontrado.');
    const preferences = await this.tripPreferences.findOne({ where: { user: { id: userId } } });
    const defaults = resolveItineraryDefaults(dto, preferences, destination.name);
    const itinerary = await this.itineraries.save(
      this.itineraries.create({
        user: { id: userId } as never,
        destination: { id: destination.id } as never,
        title: defaults.title,
        summary: dto.summary ?? '',
        start_date: toDateOnly(dto.start_date),
        end_date: toDateOnly(dto.end_date),
        duration_days: defaults.duration_days,
        budget_total: defaults.budget_total,
        currency_code: defaults.currency_code,
        generation_status: 'draft',
        generation_context: {},
        metadata: {},
      }),
    );
    await this.audit.log({ event_type: 'itinerary.created', actor_id: userId, content_type: 'Itinerary', object_id: String(itinerary.id) });
    return this.findForUser(itinerary.id, userId);
  }

  async update(id: number, userId: number, dto: UpdateItineraryDto): Promise<Itinerary> {
    const itinerary = await this.findForUser(id, userId);
    const startDate = dto.start_date !== undefined ? toDateOnly(dto.start_date) : itinerary.start_date;
    const endDate = dto.end_date !== undefined ? toDateOnly(dto.end_date) : itinerary.end_date;
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('A data final nao pode ser anterior a data inicial.');
    }
    const changes: QueryDeepPartialEntity<Itinerary> = {};
    if (dto.title !== undefined) changes.title = dto.title.trim() || itinerary.title;
    if (dto.summary !== undefined) changes.summary = dto.summary;
    if (dto.start_date !== undefined) changes.start_date = startDate;
    if (dto.end_date !== undefined) changes.end_date = endDate;
    if (dto.duration_days !== undefined) changes.duration_days = dto.duration_days;
    if (dto.budget_total !== undefined) changes.budget_total = dto.budget_total.toFixed(2);
    if (dto.currency_code !== undefined) changes.currency_code = dto.currency_code.toUpperCase();
    if (Object.keys(changes).length > 0) await this.itineraries.update({ id: itinerary.id }, changes);
    return this.findForUser(id, userId);
  }

  async markGenerating(id: number, userId: number): Promise<Itinerary> {
    const itinerary = await this.findForUser(id, userId);
    itinerary.generation_status = 'generating';
    return this.itineraries.save(itinerary);
  }

  templates(): Promise<Itinerary[]> {
    return this.itineraries.find({
      where: { generation_status: 'ready', metadata: Raw((alias) => `${alias} @> '{"is_template": true}'::jsonb`) },
      relations: { destination: true, days: { events: true }, review_stats: true },
      order: { updated_at: 'DESC' },
      take: RANKING_LIMIT,
    });
  }

  /** Paridade com o Django: so roteiros prontos e avaliados, melhor media primeiro. */
  topRated(): Promise<Itinerary[]> {
    return this.itineraries
      .createQueryBuilder('itinerary')
      .innerJoinAndSelect('itinerary.review_stats', 'stats')
      .leftJoinAndSelect('itinerary.destination', 'destination')
      .where('itinerary.generation_status = :status', { status: 'ready' })
      .andWhere('stats.review_count > 0')
      .orderBy('stats.average_rating', 'DESC')
      .addOrderBy('stats.review_count', 'DESC')
      .addOrderBy('itinerary.updated_at', 'DESC')
      .limit(RANKING_LIMIT)
      .getMany();
  }

  async daysForItinerary(id: number, userId: number): Promise<ItineraryDay[]> {
    await this.findForUser(id, userId);
    return this.days.find({ where: { itinerary: { id } }, relations: { events: { poi: true } }, order: { day_number: 'ASC', events: { order_index: 'ASC' } } });
  }

  async dayDetail(id: number, dayNumber: number, userId: number): Promise<ItineraryDay> {
    await this.findForUser(id, userId);
    const day = await this.days.findOne({ where: { itinerary: { id }, day_number: dayNumber }, relations: { events: { poi: true } } });
    if (!day) throw new NotFoundException('Dia do roteiro nao encontrado.');
    return day;
  }

  listFavorites(userId: number): Promise<FavoriteItinerary[]> {
    return this.favorites.find({ where: { user: { id: userId } }, relations: { itinerary: { destination: true } }, order: { created_at: 'DESC' } });
  }

  async createFavorite(userId: number, dto: CreateFavoriteDto): Promise<FavoriteItinerary> {
    const operation = new AuditedServiceDecorator<[CreateFavoriteDto], FavoriteItinerary>(
      {
        execute: (input) =>
          this.favorites.save(
            this.favorites.create({
              user: { id: userId } as never,
              itinerary: { id: input.itinerary } as never,
            }),
          ),
      },
      this.audit,
      'itinerary.favorited',
      () => userId,
      ([input]) => ({ itinerary_id: input.itinerary }),
    );
    return operation.execute(dto);
  }

  listReviews(itinerary?: number): Promise<Review[]> {
    return this.reviews.find({
      where: itinerary ? { itinerary: { id: itinerary } } : {},
      relations: { itinerary: true, user: true },
      order: { created_at: 'DESC' },
    });
  }

  async createReview(userId: number, dto: CreateReviewDto): Promise<Review> {
    const review = await this.reviews.save(
      this.reviews.create({
        user: { id: userId } as never,
        itinerary: { id: dto.itinerary } as never,
        rating: dto.rating,
        title: dto.title ?? '',
        body: dto.body ?? '',
      }),
    );
    const stats = await this.reviews
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'count')
      .addSelect('AVG(review.rating)', 'average')
      .where('review.itinerary_id = :itineraryId', { itineraryId: dto.itinerary })
      .getRawOne<{ count: string; average: string }>();
    const existing = await this.reviewStats.findOne({ where: { itinerary: { id: dto.itinerary } } });
    await this.reviewStats.save(
      this.reviewStats.create({
        ...(existing ?? {}),
        itinerary: { id: dto.itinerary } as never,
        review_count: Number(stats?.count ?? 0),
        average_rating: Number(stats?.average ?? 0).toFixed(2),
      }),
    );
    await this.audit.log({ event_type: 'review.created', actor_id: userId, content_type: 'Itinerary', object_id: String(dto.itinerary), metadata: { rating: dto.rating } });
    return review;
  }

  listSharedLinks(userId: number): Promise<SharedItineraryLink[]> {
    return this.sharedLinks.find({ where: { created_by: { id: userId } }, relations: { itinerary: true }, order: { created_at: 'DESC' } });
  }

  async createSharedLink(userId: number, dto: CreateSharedLinkDto): Promise<SharedItineraryLink> {
    const link = await this.sharedLinks.save(
      this.sharedLinks.create({
        created_by: { id: userId } as never,
        itinerary: { id: dto.itinerary } as never,
        token: randomUUID(),
        expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
        is_active: true,
      }),
    );
    await this.audit.log({ event_type: 'itinerary.shared', actor_id: userId, content_type: 'Itinerary', object_id: String(dto.itinerary), metadata: { token: link.token } });
    return link;
  }
}
