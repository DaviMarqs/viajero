import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
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
    const itineraries = await this.itineraries.templates();
    return this.response.withMessage('Templates de roteiros carregados com sucesso.').build(itineraries);
  }

  @Get('top-rated')
  async topRated() {
    const itineraries = await this.itineraries.topRated();
    return this.response.withMessage('Ranking de roteiros mais bem avaliados carregado com sucesso.').build(itineraries);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: AuthenticatedUser) {
    const itineraries = await this.itineraries.listForUser(user.id);
    return this.response.withMessage('Lista carregada com sucesso.').build(itineraries);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateItineraryDto) {
    const itinerary = await this.itineraries.create(user.id, dto);
    return this.response.withMessage('Registro criado com sucesso.').build(itinerary);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async retrieve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const { itinerary, isOwner } = await this.itineraries.findVisibleForUser(id, user.id);
    return this.response.withMessage('Registro carregado com sucesso.').build({ ...itinerary, is_owner: isOwner });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItineraryDto) {
    const itinerary = await this.itineraries.update(id, user.id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build({ ...itinerary, is_owner: true });
  }

  @Post(':id/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const itinerary = await this.itineraries.markGenerating(id, user.id);
    await this.generation.generate(itinerary, user.id);
    const generated = await this.itineraries.findForUser(id, user.id);
    return this.response.withMessage('Geracao de itinerario iniciada.').build(generated);
  }

  @Get(':id/days')
  @UseGuards(JwtAuthGuard)
  async days(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const days = await this.itineraries.daysForItinerary(id, user.id);
    return this.response.withMessage('Programacao do roteiro carregada com sucesso.').build(days);
  }

  @Get(':id/days/:dayNumber')
  @UseGuards(JwtAuthGuard)
  async dayDetail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Param('dayNumber', ParseIntPipe) dayNumber: number) {
    const day = await this.itineraries.dayDetail(id, dayNumber, user.id);
    return this.response.withMessage('Programacao do dia carregada com sucesso.').build(day);
  }
}
