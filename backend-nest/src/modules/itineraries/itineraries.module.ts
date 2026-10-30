import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteItinerary, Itinerary, ItineraryDailyEvent, ItineraryDay, Review, ReviewStat, SharedItineraryLink } from './entities';
import { Destination } from '../destinations/entities';
import { UserTripPreference } from '../profiles/entities';
import { ItinerariesService } from './itineraries.service';
import { ReviewsService } from './reviews.service';
import { ItinerariesController } from './itineraries.controller';
import { FavoritesController } from './favorites.controller';
import { ReviewsController } from './reviews.controller';
import { SharedLinksController } from './shared-links.controller';
import { ItineraryProgramController } from './itinerary-program.controller';
import { ItineraryProgramService } from './itinerary-program.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Itinerary,
      ItineraryDay,
      ItineraryDailyEvent,
      FavoriteItinerary,
      Review,
      ReviewStat,
      SharedItineraryLink,
      Destination,
      UserTripPreference,
    ]),
    AuditModule,
    AiModule,
  ],
  providers: [ItinerariesService, ReviewsService, ItineraryProgramService, ApiResponseBuilder],
  controllers: [ItinerariesController, ItineraryProgramController, FavoritesController, ReviewsController, SharedLinksController],
  exports: [ItinerariesService, TypeOrmModule],
})
export class ItinerariesModule {}
