import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { RefreshToken } from './refresh-token.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DjangoPasswordAdapter } from '../../common/adapters/django-password.adapter';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  providers: [UsersService, DjangoPasswordAdapter, ApiResponseBuilder],
  controllers: [UsersController],
  exports: [UsersService, DjangoPasswordAdapter, TypeOrmModule],
})
export class UsersModule {}
