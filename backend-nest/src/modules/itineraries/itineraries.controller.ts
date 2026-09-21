import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { ItineraryGenerationFacade } from '../../common/facades/itinerary-generation.facade';

@Controller('api/itineraries')
export class ItinerariesController {
  constructor(
    private readonly itineraries: ItinerariesService,
    private readonly generation: ItineraryGenerationFacade,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Get('templates')
  async templates() {
    return this.response.withMessage('Templates de roteiros carregados com sucesso.').build(await this.itineraries.templates());
  }

  @Get('top-rated')
  async topRated() {
    return this.response.withMessage('Ranking de roteiros mais bem avaliados carregado com sucesso.').build(await this.itineraries.topRated());
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.itineraries.listForUser(user.id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateItineraryDto) {
    return this.response.withMessage('Registro criado com sucesso.').build(await this.itineraries.create(user.id, dto));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async retrieve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.response.withMessage('Registro carregado com sucesso.').build(await this.itineraries.findForUser(id, user.id));
  }

  @Post(':id/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const itinerary = await this.itineraries.markGenerating(id, user.id);
    await this.generation.generate(itinerary, user.id);
    return this.response.withMessage('Geracao de itinerario iniciada.').build(await this.itineraries.findForUser(id, user.id));
  }

  @Get(':id/days')
  @UseGuards(JwtAuthGuard)
  async days(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.response.withMessage('Programacao do roteiro carregada com sucesso.').build(await this.itineraries.daysForItinerary(id, user.id));
  }

  @Get(':id/days/:dayNumber')
  @UseGuards(JwtAuthGuard)
  async dayDetail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Param('dayNumber', ParseIntPipe) dayNumber: number) {
    return this.response.withMessage('Programacao do dia carregada com sucesso.').build(await this.itineraries.dayDetail(id, dayNumber, user.id));
  }
}
