import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { ListRequest, ListRequestContext } from '../../common/query/list-request.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreatePoiDto, UpdatePoiDto } from './dto/poi-write.dto';

/** Leitura publica; escrita so para staff. */
@Controller('api/pois')
export class PoisController {
  constructor(private readonly destinations: DestinationsService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@ListRequest() request: ListRequestContext) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.destinations.listPoisWithQuery(request));
  }

  @Get(':id')
  async retrieve(@Param('id', ParseIntPipe) id: number) {
    return this.response.withMessage('Registro carregado com sucesso.').build(await this.destinations.findPoi(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePoiDto) {
    return this.response.withMessage('Registro criado com sucesso.').build(await this.destinations.createPoi(dto, user.id));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, StaffGuard)
  async replace(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreatePoiDto) {
    return this.response.withMessage('Registro atualizado com sucesso.').build(await this.destinations.updatePoi(id, dto, user.id));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, StaffGuard)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePoiDto) {
    return this.response.withMessage('Registro atualizado com sucesso.').build(await this.destinations.updatePoi(id, dto, user.id));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, StaffGuard)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.destinations.removePoi(id, user.id);
    return this.response.withMessage('Registro removido com sucesso.').build(null);
  }
}
