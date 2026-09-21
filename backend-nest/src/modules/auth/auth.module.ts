import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET_KEY', 'unsafe-dev-secret'),
        signOptions: { expiresIn: `${config.get<number>('JWT_ACCESS_MINUTES', 60)}m` },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, ApiResponseBuilder],
  controllers: [AuthController],
})
export class AuthModule {}
