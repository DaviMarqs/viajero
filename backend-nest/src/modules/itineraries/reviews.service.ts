import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Itinerary, Review, ReviewStat } from './entities';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AuditService } from '../audit/audit.service';
import { canReviewItinerary, canViewItinerary } from './itinerary-rules';
import { PresentedReview, presentReview } from './review.presenter';

const LIST_LIMIT = 100;
const DUPLICATE_MESSAGE = 'Voce ja avaliou este roteiro.';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewStat) private readonly stats: Repository<ReviewStat>,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    private readonly audit: AuditService,
  ) {}

  async list(itineraryId?: number): Promise<PresentedReview[]> {
    const reviews = await this.reviews.find({
      where: itineraryId ? { itinerary: { id: itineraryId } } : {},
      relations: { user: true, itinerary: true },
      order: { created_at: 'DESC' },
      take: itineraryId ? undefined : LIST_LIMIT,
    });
    return reviews.map(presentReview);
  }

  async create(userId: number, dto: CreateReviewDto): Promise<PresentedReview> {
    const itinerary = await this.itineraries.findOne({ where: { id: dto.itinerary }, relations: { review_stats: true } });
    const isOwner = itinerary ? await this.itineraries.exists({ where: { id: dto.itinerary, user: { id: userId } } }) : false;
    if (!itinerary || !canViewItinerary(itinerary, isOwner)) throw new NotFoundException('Roteiro nao encontrado.');
    if (!canReviewItinerary(itinerary, isOwner)) throw new BadRequestException('So e possivel avaliar roteiros prontos.');
    if (await this.reviews.exists({ where: { itinerary: { id: dto.itinerary }, user: { id: userId } } })) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }

    let saved: Review;
    try {
      saved = await this.reviews.save(
        this.reviews.create({
          itinerary: { id: dto.itinerary } as never,
          user: { id: userId } as never,
          rating: dto.rating,
          title: dto.title?.trim() ?? '',
          body: dto.body?.trim() ?? '',
        }),
      );
    } catch (error) {
      // Corrida entre duas requisicoes: a constraint unique do Django decide.
      if (isUniqueViolation(error)) throw new ConflictException(DUPLICATE_MESSAGE);
      throw error;
    }

    await this.refreshStats(dto.itinerary);
    await this.audit.log({
      event_type: 'review.created',
      actor_id: userId,
      content_type: 'Review',
      object_id: String(saved.id),
      metadata: { itinerary_id: dto.itinerary, rating: dto.rating },
    });
    return this.findPresented(saved.id);
  }

  async update(userId: number, id: number, dto: UpdateReviewDto): Promise<PresentedReview> {
    const review = await this.findOwned(userId, id);
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title.trim();
    if (dto.body !== undefined) review.body = dto.body.trim();
    await this.reviews.save(review);

    const itineraryId = Number(review.itinerary.id);
    await this.refreshStats(itineraryId);
    await this.audit.log({
      event_type: 'review.updated',
      actor_id: userId,
      content_type: 'Review',
      object_id: String(review.id),
      metadata: { itinerary_id: itineraryId, rating: review.rating },
    });
    return this.findPresented(review.id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const review = await this.findOwned(userId, id);
    const itineraryId = Number(review.itinerary.id);
    await this.reviews.delete({ id: review.id });
    await this.refreshStats(itineraryId);
    await this.audit.log({
      event_type: 'review.deleted',
      actor_id: userId,
      content_type: 'Review',
      object_id: String(id),
      metadata: { itinerary_id: itineraryId, rating: review.rating },
    });
  }

  private async findOwned(userId: number, id: number): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id, user: { id: userId } }, relations: { itinerary: true } });
    if (!review) throw new NotFoundException('Avaliacao nao encontrada.');
    return review;
  }

  private async findPresented(id: number): Promise<PresentedReview> {
    const review = await this.reviews.findOneOrFail({ where: { id }, relations: { user: true, itinerary: true } });
    return presentReview(review);
  }

  /** Sem avaliacoes o contador zera e o roteiro sai do ranking (volta a ser privado). */
  private async refreshStats(itineraryId: number): Promise<void> {
    const totals = await this.reviews
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'count')
      .addSelect('AVG(review.rating)', 'average')
      .where('review.itinerary_id = :itineraryId', { itineraryId })
      .getRawOne<{ count: string | number; average: string | null }>();
    const existing = await this.stats.findOne({ where: { itinerary: { id: itineraryId } } });
    await this.stats.save(
      this.stats.create({
        ...(existing ?? {}),
        itinerary: { id: itineraryId } as never,
        review_count: Number(totals?.count ?? 0),
        average_rating: Number(totals?.average ?? 0).toFixed(2),
      }),
    );
  }
}
