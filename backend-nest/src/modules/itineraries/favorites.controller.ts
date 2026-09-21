import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ItinerariesService } from './itineraries.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly itineraries: ItinerariesService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.itineraries.listFavorites(user.id));
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFavoriteDto) {
    return this.response.withMessage('Registro criado com sucesso.').build(await this.itineraries.createFavorite(user.id, dto));
  }
}
