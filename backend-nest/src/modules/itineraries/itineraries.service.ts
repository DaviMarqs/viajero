import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteItinerary, Itinerary, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateSharedLinkDto } from './dto/create-shared-link.dto';
import { AuditService } from '../audit/audit.service';
import { AuditedServiceDecorator } from '../../common/decorators/audited-service.decorator';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(ItineraryDay) private readonly days: Repository<ItineraryDay>,
    @InjectRepository(FavoriteItinerary) private readonly favorites: Repository<FavoriteItinerary>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewStat) private readonly reviewStats: Repository<ReviewStat>,
    @InjectRepository(SharedItineraryLink) private readonly sharedLinks: Repository<SharedItineraryLink>,
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
    if (!itinerary) throw new NotFoundException('Itinerary not found.');
    return itinerary;
  }

  async create(userId: number, dto: CreateItineraryDto): Promise<Itinerary> {
    const itinerary = await this.itineraries.save(
      this.itineraries.create({
        user: { id: userId } as never,
        destination: { id: dto.destination } as never,
        title: dto.title,
        summary: dto.summary ?? '',
        start_date: dto.start_date ?? null,
        end_date: dto.end_date ?? null,
        duration_days: dto.duration_days,
        budget_total: dto.budget_total !== undefined ? String(dto.budget_total) : '0',
        currency_code: dto.currency_code ?? 'BRL',
        generation_status: 'draft',
        generation_context: {},
        metadata: {},
      }),
    );
    await this.audit.log({ event_type: 'itinerary.created', actor_id: userId, content_type: 'Itinerary', object_id: String(itinerary.id) });
    return this.findForUser(itinerary.id, userId);
  }

  async markGenerating(id: number, userId: number): Promise<Itinerary> {
    const itinerary = await this.findForUser(id, userId);
    itinerary.generation_status = 'generating';
    return this.itineraries.save(itinerary);
  }

  templates(): Promise<Itinerary[]> {
    return this.itineraries.find({
      where: { generation_status: 'ready' },
      relations: { destination: true, days: { events: true } },
      order: { updated_at: 'DESC' },
      take: 10,
    });
  }

  topRated(): Promise<Itinerary[]> {
    return this.itineraries.find({
      where: { generation_status: 'ready' },
      relations: { destination: true, review_stats: true, days: { events: true } },
      order: { updated_at: 'DESC' },
      take: 10,
    });
  }

  async daysForItinerary(id: number, userId: number): Promise<ItineraryDay[]> {
    await this.findForUser(id, userId);
    return this.days.find({ where: { itinerary: { id } }, relations: { events: { poi: true } }, order: { day_number: 'ASC', events: { order_index: 'ASC' } } });
  }

  async dayDetail(id: number, dayNumber: number, userId: number): Promise<ItineraryDay> {
    await this.findForUser(id, userId);
    const day = await this.days.findOne({ where: { itinerary: { id }, day_number: dayNumber }, relations: { events: { poi: true } } });
    if (!day) throw new NotFoundException('Itinerary day not found.');
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
