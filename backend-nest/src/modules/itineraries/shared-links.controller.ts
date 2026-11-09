import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ItinerariesService } from './itineraries.service';
import { SharedLinksService } from './shared-links.service';
import { CreateSharedLinkDto } from './dto/create-shared-link.dto';
import { ReplaceSharedLinkDto, UpdateSharedLinkDto } from './dto/update-shared-link.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/shared-links')
@UseGuards(JwtAuthGuard)
export class SharedLinksController {
  constructor(
    private readonly itineraries: ItinerariesService,
    private readonly links: SharedLinksService,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.itineraries.listSharedLinks(user.id));
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSharedLinkDto) {
    return this.response.withMessage('Registro criado com sucesso.').build(await this.itineraries.createSharedLink(user.id, dto));
  }

  @Get(':id')
  async retrieve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.response.withMessage('Registro carregado com sucesso.').build(await this.links.findOwned(user.id, id));
  }

  @Put(':id')
  async replace(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReplaceSharedLinkDto) {
    return this.response.withMessage('Registro atualizado com sucesso.').build(await this.links.update(user.id, id, dto));
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSharedLinkDto) {
    return this.response.withMessage('Registro atualizado com sucesso.').build(await this.links.update(user.id, id, dto));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.links.remove(user.id, id);
    return this.response.withMessage('Registro removido com sucesso.').build(null);
  }
}
