import { BadRequestException, Injectable } from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { Destination } from './entities';
import { AuditService } from '../audit/audit.service';
import { DestinationAiService } from './discovery/destination-ai.service';
import { DestinationDiscoveryService } from './discovery/destination-discovery.service';
import { isValidPlace } from './discovery/destination-prompts';
import { slugify } from './discovery/slug';

interface SearchInput {
  q?: string;
  country?: string;
  city?: string;
  actorId?: number | null;
}

/**
 * Busca de destino da tela de planejamento (paridade com `DestinationViewSet.search` do Django):
 * banco local -> resolver de IA (rejeita termos que nao sao lugares) -> descoberta com Firecrawl + LLM.
 */
@Injectable()
export class DestinationDiscoveryFacade {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly ai: DestinationAiService,
    private readonly discovery: DestinationDiscoveryService,
    private readonly audit: AuditService,
  ) {}

  async searchOrDiscover(input: SearchInput): Promise<{ data: Destination[]; discovered: boolean }> {
    const q = input.q?.trim() ?? '';
    const local = await this.destinations.search(input);
    if (local.length > 0 || !q) return { data: local, discovered: false };

    // Sem nenhuma fonte externa configurada (sem chaves), mantem o destino basico para o fluxo seguir offline.
    if (!this.discovery.isAvailable()) return { data: [await this.createBasic(q, input)], discovered: true };

    let name = q;
    let country = input.country?.trim() ?? '';
    let city = input.city?.trim() ?? '';
    let region = '';
    const resolved = await this.ai.resolve(q);
    if (resolved) {
      if (!isValidPlace(resolved)) {
        await this.audit.log({
          event_type: 'destination.search_rejected',
          actor_id: input.actorId ?? null,
          metadata: { query: q, confidence: resolved.confidence },
        });
        throw new BadRequestException({
          message: 'Nao reconhecemos esse termo como um destino de viagem. Tente o nome de uma cidade, regiao ou pais.',
          errors: { q: ['nao parece um destino de viagem valido'] },
        });
      }
      name = resolved.name || q;
      country = resolved.country || country;
      city = resolved.city || city;
      region = resolved.region;
      // O nome canonico pode ja existir no banco (ex.: "lisboa" -> "Lisbon").
      for (const term of [...new Set([name, city].filter(Boolean))]) {
        const found = await this.destinations.search({ q: term });
        if (found.length > 0) return { data: found, discovered: false };
      }
    }

    const destinationId = await this.discovery.discover({ query: name, country, city, region, actorId: input.actorId });
    if (destinationId === null) return { data: [], discovered: false };

    const destination = await this.destinations.findOne(destinationId);
    await this.audit.log({
      event_type: 'destination.discovered',
      actor_id: input.actorId ?? null,
      content_type: 'Destination',
      object_id: String(destination.id),
      metadata: { query: q, country, city, sources: destination.metadata?.sources ?? {} },
    });
    return { data: [destination], discovered: true };
  }

  private async createBasic(q: string, input: SearchInput): Promise<Destination> {
    const slug = slugify(q);
    const existing = slug ? await this.destinations.findBySlug(slug) : null;
    if (existing) return existing;
    const destination = await this.destinations.create(
      { slug, name: q, country: input.country || 'Desconhecido', city: input.city || '', summary: '' },
      input.actorId ?? undefined,
    );
    await this.audit.log({
      event_type: 'destination.discovered',
      actor_id: input.actorId ?? null,
      content_type: 'Destination',
      object_id: String(destination.id),
      metadata: { query: q, country: input.country ?? '', city: input.city ?? '', source: 'nest-basic-discovery' },
    });
    return this.destinations.findOne(destination.id);
  }
}
