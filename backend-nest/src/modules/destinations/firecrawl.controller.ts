import { Body, Controller, HttpCode, HttpStatus, NotFoundException, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { requireStaff } from '../auth/staff.guard';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditService } from '../audit/audit.service';
import { DestinationsService } from './destinations.service';
import { FirecrawlClient, FirecrawlError } from './discovery/firecrawl.client';
import { DestinationDiscoveryService } from './discovery/destination-discovery.service';
import { FirecrawlIngestDto } from './dto/firecrawl-ingest.dto';

/** Ingestao manual de URLs para um destino (admin), como `POST /api/firecrawl/ingest/` do Django. */
@Controller('api/firecrawl')
@UseGuards(JwtAuthGuard)
export class FirecrawlController {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly firecrawl: FirecrawlClient,
    private readonly discovery: DestinationDiscoveryService,
    private readonly audit: AuditService,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(@CurrentUser() user: AuthenticatedUser, @Body() dto: FirecrawlIngestDto) {
    requireStaff(user, 'Apenas administradores podem ingerir conteudo do Firecrawl.');
    if (!this.firecrawl.isConfigured()) throw new ServiceUnavailableException('Firecrawl nao configurado. Defina FIRECRAWL_API_KEY no backend.');
    const destination = await this.destinations.findOne(dto.destination_id).catch(() => {
      throw new NotFoundException('Destino nao encontrado.');
    });

    let extraction;
    try {
      extraction = await this.firecrawl.aggregate(dto.source_urls);
    } catch (error) {
      if (error instanceof FirecrawlError) throw new ServiceUnavailableException('Nao foi possivel extrair conteudo das URLs informadas.');
      throw error;
    }
    const result = await this.discovery.ingest(Number(destination.id), extraction);
    await this.audit.log({
      event_type: 'firecrawl.ingested',
      actor_id: user.id,
      content_type: 'Destination',
      object_id: String(destination.id),
      metadata: { source_urls: dto.source_urls, poi_count: result.poiCount },
    });
    return this.response.withMessage('Conteudo do Firecrawl ingerido com sucesso.').build({
      destination_updated: true,
      poi_count: result.poiCount,
      cost_profile_updated: result.costProfileUpdated,
    });
  }
}
