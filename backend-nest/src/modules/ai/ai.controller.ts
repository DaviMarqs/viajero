import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AiService } from './ai.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService, private readonly response: ApiResponseBuilder) {}

  @Get('llm-models')
  async models() {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.ai.listModels());
  }

  @Get('llm-jobs')
  async jobs(@CurrentUser() user: AuthenticatedUser) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.ai.listJobs(user.id));
  }
}
