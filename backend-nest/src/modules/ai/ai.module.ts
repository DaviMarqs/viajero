import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmJob, LlmJobLog, LlmModel, LlmProvider, PromptTemplate } from './entities';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { Itinerary, ItineraryDailyEvent, ItineraryDay } from '../itineraries/entities';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';
import { PointOfInterest } from '../destinations/entities';
import { ItineraryGeneratorFactory } from '../../common/factories/itinerary-generator.factory';
import { ItineraryGenerationFacade } from '../../common/facades/itinerary-generation.facade';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LlmProvider,
      LlmModel,
      PromptTemplate,
      LlmJob,
      LlmJobLog,
      Itinerary,
      ItineraryDay,
      ItineraryDailyEvent,
      TravelerDnaProfile,
      UserTripPreference,
      PointOfInterest,
    ]),
  ],
  providers: [AiService, ItineraryGeneratorFactory, ItineraryGenerationFacade, ApiResponseBuilder],
  controllers: [AiController],
  exports: [AiService, ItineraryGenerationFacade, TypeOrmModule],
})
export class AiModule {}
