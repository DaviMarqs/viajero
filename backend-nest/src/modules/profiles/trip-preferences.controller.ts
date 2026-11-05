import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfilesService } from './profiles.service';
import { TripPreferenceDto } from './dto/trip-preference.dto';
import { UpdateTripPreferenceDto } from './dto/update-trip-preference.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/trip-preferences')
@UseGuards(JwtAuthGuard)
export class TripPreferencesController {
  constructor(private readonly profiles: ProfilesService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async getRoot(@CurrentUser() user: AuthenticatedUser) {
    const preference = await this.profiles.getTripPreference(user.id);
    return this.response.withMessage('Registro carregado com sucesso.').build(preference);
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.getRoot(user);
  }

  @Patch()
  async patchRoot(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTripPreferenceDto) {
    const preference = await this.profiles.upsertTripPreference(user.id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(preference);
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTripPreferenceDto) {
    return this.patchRoot(user, dto);
  }

  @Put('me')
  async putMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: TripPreferenceDto) {
    return this.patchRoot(user, dto);
  }

  // Rotas REST do Django (create + detalhe por id). So o dono; 409 se as preferencias ja existem.
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: TripPreferenceDto) {
    const preference = await this.profiles.createTripPreference(user.id, dto);
    return this.response.withMessage('Registro criado com sucesso.').build(preference);
  }

  @Get(':id')
  async retrieve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const preference = await this.profiles.findOwnedTripPreference(user.id, id);
    return this.response.withMessage('Registro carregado com sucesso.').build(preference);
  }

  @Put(':id')
  async replace(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: TripPreferenceDto) {
    const preference = await this.profiles.updateOwnedTripPreference(user.id, id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(preference);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTripPreferenceDto) {
    const preference = await this.profiles.updateOwnedTripPreference(user.id, id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(preference);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.profiles.removeOwnedTripPreference(user.id, id);
    return this.response.withMessage('Registro removido com sucesso.').build(null);
  }
}
