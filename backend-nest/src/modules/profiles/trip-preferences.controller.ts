import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
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
}
