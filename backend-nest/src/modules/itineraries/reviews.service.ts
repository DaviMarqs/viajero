import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Itinerary, Review, ReviewStat } from './entities';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AuditService } from '../audit/audit.service';
import { canReviewItinerary, canViewItinerary } from './itinerary-rules';
import { PresentedReview, presentReview } from './review.presenter';
import { ReplaceReviewDto } from './dto/replace-review.dto';
import { ListQueryOptions, orderByIds, PaginatedList, parseListQuery, runListQuery } from '../../common/query/list-query';
import { ListRequestContext } from '../../common/query/list-request.decorator';

const LIST_LIMIT = 100;
const DUPLICATE_MESSAGE = 'Voce ja avaliou este roteiro.';

/** Mesmos campos do ReviewViewSet do Django (sem busca). */
export const REVIEW_LIST_OPTIONS: ListQueryOptions = {
  filters: { itinerary: { column: 'itinerary_id', type: 'int' }, rating: { column: 'rating', type: 'int' } },
  orderingFields: ['created_at', 'rating'],
  defaultOrdering: ['-created_at'],
};

/** Avaliacao visivel: autor, ou roteiro visivel para quem pede (dono ou publico), como no detalhe do roteiro. */
export function canViewReview(review: { user: { id: number }; itinerary: Parameters<typeof canViewItinerary>[0] }, viewerId: number | null, isItineraryOwner: boolean): boolean {
  if (viewerId !== null && Number(review.user.id) === Number(viewerId)) return true;
  return canViewItinerary(review.itinerary, isItineraryOwner);
}

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

  /** Publica. Sem `page` segue como antes: todas as do roteiro filtrado ou as 100 mais recentes. */
  list(request: ListRequestContext): Promise<PresentedReview[] | PaginatedList<PresentedReview>> {
    const query = parseListQuery(request.query, REVIEW_LIST_OPTIONS);
    return runListQuery({
      qb: this.reviews.createQueryBuilder('review'),
      query,
      options: REVIEW_LIST_OPTIONS,
      url: request.url,
      unpaginatedLimit: query.filters.itinerary !== undefined ? undefined : LIST_LIMIT,
      present: async (rows) => {
        const ids = rows.map((row) => row.id);
        if (!ids.length) return [];
        const loaded = await this.reviews.find({ where: { id: In(ids) }, relations: { user: true, itinerary: true } });
        return orderByIds(loaded, ids).map(presentReview);
      },
    });
  }

  /** GET /:id (publico, token opcional). Avaliacao de roteiro que deixou de ser publico so aparece para autor e dono. */
  async findVisible(id: number, viewerId: number | null): Promise<PresentedReview> {
    const review = await this.reviews.findOne({ where: { id }, relations: { user: true, itinerary: { review_stats: true } } });
    if (!review) throw new NotFoundException('Avaliacao nao encontrada.');
    const isOwner = viewerId !== null && (await this.itineraries.exists({ where: { id: review.itinerary.id, user: { id: viewerId } } }));
    if (!canViewReview(review, viewerId, isOwner)) throw new NotFoundException('Avaliacao nao encontrada.');
    return presentReview(review);
  }

  /** PUT /:id: mesmas regras do PATCH (so o autor, estatistica recalculada); nao muda o roteiro avaliado. */
  async replace(userId: number, id: number, dto: ReplaceReviewDto): Promise<PresentedReview> {
    const review = await this.findOwned(userId, id);
    if (dto.itinerary !== undefined && dto.itinerary !== Number(review.itinerary.id)) {
      throw new BadRequestException({
        message: 'Nao e possivel mover a avaliacao para outro roteiro.',
        errors: { itinerary: ['Nao e possivel mover a avaliacao para outro roteiro.'] },
      });
    }
    return this.update(userId, id, { rating: dto.rating, title: dto.title, body: dto.body });
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
