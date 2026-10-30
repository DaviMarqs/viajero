import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelerDnaProfile, UserTripPreference } from './entities';
import { User } from '../users/user.entity';
import { ProfilesService } from './profiles.service';
import { TravelerDnaController } from './traveler-dna.controller';
import { TripPreferencesController } from './trip-preferences.controller';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([TravelerDnaProfile, UserTripPreference, User]), AuditModule],
  providers: [ProfilesService, ApiResponseBuilder],
  controllers: [TravelerDnaController, TripPreferencesController],
  exports: [ProfilesService, TypeOrmModule],
})
export class ProfilesModule {}
