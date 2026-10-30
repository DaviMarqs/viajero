import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { ItineraryProgramService } from './itinerary-program.service';
import { UpdateItineraryProgramDto } from './dto/update-itinerary-program.dto';

/** Edicao da programacao (#50): so o dono, so roteiro pronto. Responde o roteiro completo, como o GET /:id. */
@Controller('api/itineraries')
@UseGuards(JwtAuthGuard)
export class ItineraryProgramController {
  constructor(
    private readonly program: ItineraryProgramService,
    private readonly response: ApiResponseBuilder,
  ) {}

  @Put(':id/program')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItineraryProgramDto) {
    const itinerary = await this.program.updateProgram(id, user.id, dto);
    return this.response.withMessage('Programacao do roteiro atualizada com sucesso.').build({ ...itinerary, is_owner: true });
  }

  @Post(':id/program/undo')
  @HttpCode(HttpStatus.OK)
  async undo(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const itinerary = await this.program.undoProgram(id, user.id);
    return this.response.withMessage('Ultima alteracao da programacao desfeita.').build({ ...itinerary, is_owner: true });
  }
}
