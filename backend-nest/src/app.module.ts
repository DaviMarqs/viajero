import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DestinationsModule } from './modules/destinations/destinations.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ItinerariesModule } from './modules/itineraries/itineraries.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
    AuditModule,
    UsersModule,
    AuthModule,
    DestinationsModule,
    ProfilesModule,
    ItinerariesModule,
    AiModule,
  ],
})
export class AppModule {}
