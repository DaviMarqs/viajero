import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfilesService } from './profiles.service';
import { TravelerDnaDto } from './dto/traveler-dna.dto';
import { UpdateTravelerDnaDto } from './dto/update-traveler-dna.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/traveler-dna')
@UseGuards(JwtAuthGuard)
export class TravelerDnaController {
  constructor(private readonly profiles: ProfilesService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async getRoot(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.profiles.getDna(user.id);
    return this.response.withMessage('Registro carregado com sucesso.').build(profile);
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.getRoot(user);
  }

  @Patch()
  async patchRoot(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTravelerDnaDto) {
    const profile = await this.profiles.upsertDna(user.id, dto);
    return this.response.withMessage('Registro atualizado com sucesso.').build(profile);
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTravelerDnaDto) {
    return this.patchRoot(user, dto);
  }

  @Put('me')
  async putMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: TravelerDnaDto) {
    return this.patchRoot(user, dto);
  }
}
