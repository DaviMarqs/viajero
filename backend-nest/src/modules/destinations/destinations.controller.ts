import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DestinationsService } from './destinations.service';
import { DestinationDiscoveryFacade } from './destination-discovery.facade';
import { DestinationSuggestionService } from './destination-suggestion.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

interface MaybeAuthRequest extends Request {
  user?: AuthenticatedUser;
}

@Controller('api/destinations')
export class DestinationsController {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly discovery: DestinationDiscoveryFacade,
    private readonly suggestions: DestinationSuggestionService,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Get()
  async list() {
    const destinations = await this.destinations.list();
    return this.response.withMessage('Lista carregada com sucesso.').build(destinations);
  }

  @Get('search')
  async search(@Query('q') q?: string, @Query('country') country?: string, @Query('city') city?: string, @Req() request?: MaybeAuthRequest) {
    const result = await this.discovery.searchOrDiscover({ q, country, city, actorId: request?.user?.id ?? null });
    return this.response
      .withMessage(result.discovered ? 'Resultados carregados (destino enriquecido).' : 'Resultados da busca carregados com sucesso.')
      .build(result.data);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async suggest(@CurrentUser() user: AuthenticatedUser) {
    const destination = await this.suggestions.suggest(user.id);
    return this.response.withMessage(`Destino sugerido com base no seu perfil: ${destination.name}.`).build(destination);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateDestinationDto) {
    const destination = await this.destinations.create(dto);
    return this.response.withMessage('Registro criado com sucesso.').build(destination);
  }

  @Get(':id')
  async retrieve(@Param('id', ParseIntPipe) id: number) {
    const destination = await this.destinations.findOne(id);
    return this.response.withMessage('Registro carregado com sucesso.').build(destination);
  }
}
