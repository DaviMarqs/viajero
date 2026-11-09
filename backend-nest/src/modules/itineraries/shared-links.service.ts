import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { SharedItineraryLink } from './entities';
import { ItinerariesService } from './itineraries.service';
import { UpdateSharedLinkDto } from './dto/update-shared-link.dto';
import { AuditService } from '../audit/audit.service';

/** Detalhe, edicao e remocao de links (so quem criou). Listar e criar continuam no ItinerariesService. */
@Injectable()
export class SharedLinksService {
  constructor(
    @InjectRepository(SharedItineraryLink) private readonly links: Repository<SharedItineraryLink>,
    private readonly itineraries: ItinerariesService,
    private readonly audit: AuditService,
  ) {}

  /** Mesmo formato dos itens de GET /api/shared-links (com o roteiro). */
  async findOwned(userId: number, id: number): Promise<SharedItineraryLink> {
    const link = await this.links.findOne({ where: { id, created_by: { id: userId } }, relations: { itinerary: true } });
    if (!link) throw new NotFoundException('Link compartilhado nao encontrado.');
    return link;
  }

  /** PUT/PATCH: o token nao muda; trocar o roteiro exige que o usuario possa ve-lo (dono ou publico). */
  async update(userId: number, id: number, dto: UpdateSharedLinkDto): Promise<SharedItineraryLink> {
    const link = await this.findOwned(userId, id);
    const changes: QueryDeepPartialEntity<SharedItineraryLink> = {};
    if (dto.itinerary !== undefined && dto.itinerary !== Number(link.itinerary.id)) {
      await this.itineraries.findVisibleForUser(dto.itinerary, userId);
      changes.itinerary = { id: dto.itinerary };
    }
    if (dto.expires_at !== undefined) changes.expires_at = dto.expires_at ? new Date(dto.expires_at) : null;
    if (dto.is_active !== undefined) changes.is_active = dto.is_active;
    if (Object.keys(changes).length > 0) {
      await this.links.update({ id: link.id }, changes);
      await this.audit.log({
        event_type: 'itinerary.share_updated',
        actor_id: userId,
        content_type: 'SharedItineraryLink',
        object_id: String(link.id),
        metadata: { token: link.token, fields: Object.keys(changes) },
      });
    }
    return this.findOwned(userId, id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const link = await this.findOwned(userId, id);
    await this.links.delete({ id: link.id });
    await this.audit.log({
      event_type: 'itinerary.unshared',
      actor_id: userId,
      content_type: 'Itinerary',
      object_id: String(link.itinerary.id),
      metadata: { token: link.token },
    });
  }
}
