import { Injectable } from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { Destination } from './entities';
import { AuditService } from '../audit/audit.service';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

@Injectable()
export class DestinationDiscoveryFacade {
  constructor(private readonly destinations: DestinationsService, private readonly audit: AuditService) {}

  async searchOrDiscover(input: { q?: string; country?: string; city?: string; actorId?: number | null }): Promise<{ data: Destination[]; discovered: boolean }> {
    const local = await this.destinations.search(input);
    if (local.length > 0 || !input.q?.trim()) {
      return { data: local, discovered: false };
    }

    const destination = await this.destinations.create(
      {
        slug: slugify(input.q),
        name: input.q.trim(),
        country: input.country || 'Desconhecido',
        city: input.city || '',
        summary: `Destino criado a partir da busca por "${input.q}". Configure FIRECRAWL/Gemini no backend Django para enriquecimento completo.`,
      },
      input.actorId ?? undefined,
    );
    await this.audit.log({
      event_type: 'destination.discovered',
      actor_id: input.actorId ?? null,
      content_type: 'Destination',
      object_id: String(destination.id),
      metadata: { query: input.q, country: input.country ?? '', city: input.city ?? '', source: 'nest-basic-discovery' },
    });
    return { data: [await this.destinations.findOne(destination.id)], discovered: true };
  }
}
