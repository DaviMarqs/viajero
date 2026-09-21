import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DestinationsService } from './destinations.service';
import { DestinationDiscoveryFacade } from './destination-discovery.facade';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

interface MaybeAuthRequest extends Request {
  user?: AuthenticatedUser;
}

@Controller('api/destinations')
export class DestinationsController {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly discovery: DestinationDiscoveryFacade,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Get()
  async list() {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.destinations.list());
  }

  @Get('search')
  async search(@Query('q') q?: string, @Query('country') country?: string, @Query('city') city?: string, @Req() request?: MaybeAuthRequest) {
    const result = await this.discovery.searchOrDiscover({ q, country, city, actorId: request?.user?.id ?? null });
    return this.response
      .withMessage(result.discovered ? 'Resultados carregados (destino enriquecido).' : 'Resultados da busca carregados com sucesso.')
      .build(result.data);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateDestinationDto) {
    return this.response.withMessage('Registro criado com sucesso.').build(await this.destinations.create(dto));
  }

  @Get(':id')
  async retrieve(@Param('id', ParseIntPipe) id: number) {
    return this.response.withMessage('Registro carregado com sucesso.').build(await this.destinations.findOne(id));
  }
}
