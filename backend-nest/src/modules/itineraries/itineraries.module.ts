import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteItinerary, Itinerary, ItineraryDailyEvent, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { ItinerariesService } from './itineraries.service';
import { ItinerariesController } from './itineraries.controller';
import { FavoritesController } from './favorites.controller';
import { ReviewsController } from './reviews.controller';
import { SharedLinksController } from './shared-links.controller';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Itinerary, ItineraryDay, ItineraryDailyEvent, FavoriteItinerary, Review, ReviewStat, SharedItineraryLink]), AuditModule, AiModule],
  providers: [ItinerariesService, ApiResponseBuilder],
  controllers: [ItinerariesController, FavoritesController, ReviewsController, SharedLinksController],
  exports: [ItinerariesService, TypeOrmModule],
})
export class ItinerariesModule {}
