import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Destination, DestinationCostProfile, PoiTag, PointOfInterest } from './entities';
import { Itinerary } from '../itineraries/entities';
import { DestinationsService } from './destinations.service';
import { DestinationsController } from './destinations.controller';
import { PoisController } from './pois.controller';
import { DestinationDiscoveryFacade } from './destination-discovery.facade';
import { DestinationSuggestionService } from './destination-suggestion.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { LlmModule } from '../ai/llm/llm.module';
import { FirecrawlClient } from './discovery/firecrawl.client';
import { DestinationAiService } from './discovery/destination-ai.service';
import { DestinationDiscoveryService } from './discovery/destination-discovery.service';
import { FirecrawlController } from './firecrawl.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Destination, DestinationCostProfile, PoiTag, PointOfInterest, Itinerary]), AuditModule, ProfilesModule, LlmModule],
  providers: [
    DestinationsService,
    DestinationDiscoveryFacade,
    DestinationSuggestionService,
    FirecrawlClient,
    DestinationAiService,
    DestinationDiscoveryService,
    ApiResponseBuilder,
  ],
  controllers: [DestinationsController, PoisController, FirecrawlController],
  exports: [DestinationsService, TypeOrmModule],
})
export class DestinationsModule {}
