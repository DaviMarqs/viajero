import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Destination, DestinationCostProfile, PoiTag, PointOfInterest } from './entities';
import { DestinationsService } from './destinations.service';
import { DestinationsController } from './destinations.controller';
import { PoisController } from './pois.controller';
import { DestinationDiscoveryFacade } from './destination-discovery.facade';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Destination, DestinationCostProfile, PoiTag, PointOfInterest]), AuditModule],
  providers: [DestinationsService, DestinationDiscoveryFacade, ApiResponseBuilder],
  controllers: [DestinationsController, PoisController],
  exports: [DestinationsService, TypeOrmModule],
})
export class DestinationsModule {}
