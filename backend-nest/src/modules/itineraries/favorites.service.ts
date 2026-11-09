import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteItinerary } from './entities';
import { ItinerariesService } from './itineraries.service';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { AuditService } from '../audit/audit.service';

/** Detalhe e edicao de favoritos (so o dono). Listar, criar e remover continuam no ItinerariesService. */
@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteItinerary) private readonly favorites: Repository<FavoriteItinerary>,
    private readonly itineraries: ItinerariesService,
    private readonly audit: AuditService,
  ) {}

  /** Mesmo formato dos itens de GET /api/favorites (roteiro com destino). */
  async findOwned(userId: number, id: number): Promise<FavoriteItinerary> {
    const favorite = await this.favorites.findOne({ where: { id, user: { id: userId } }, relations: { itinerary: { destination: true } } });
    if (!favorite) throw new NotFoundException('Favorito nao encontrado.');
    return favorite;
  }

  /** PUT/PATCH: troca o roteiro favoritado por outro que o usuario pode ver e que ainda nao e favorito. */
  async update(userId: number, id: number, dto: UpdateFavoriteDto): Promise<FavoriteItinerary> {
    const favorite = await this.findOwned(userId, id);
    const previous = Number(favorite.itinerary.id);
    if (dto.itinerary !== undefined && dto.itinerary !== previous) {
      await this.itineraries.findVisibleForUser(dto.itinerary, userId);
      if (await this.favorites.exists({ where: { user: { id: userId }, itinerary: { id: dto.itinerary } } })) {
        throw new ConflictException('Este roteiro ja esta nos seus favoritos.');
      }
      await this.favorites.update({ id: favorite.id }, { itinerary: { id: dto.itinerary } });
      await this.audit.log({
        event_type: 'favorite.updated',
        actor_id: userId,
        content_type: 'FavoriteItinerary',
        object_id: String(favorite.id),
        metadata: { from_itinerary_id: previous, itinerary_id: dto.itinerary },
      });
    }
    return this.findOwned(userId, id);
  }
}
