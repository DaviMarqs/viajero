import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { requireStaff } from '../auth/staff.guard';
import { AiService } from './ai.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

const requireAdmin = (user: AuthenticatedUser) => requireStaff(user, 'Apenas administradores podem acessar os templates de prompt.');

@Controller('api')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService, private readonly response: ApiResponseBuilder) {}

  @Get('llm-models')
  async models() {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.ai.listModels());
  }

  @Get('llm-models/:id')
  async model(@Param('id', ParseIntPipe) id: number) {
    const model = await this.ai.findModel(id);
    if (!model) throw new NotFoundException('Modelo nao encontrado.');
    return this.response.withMessage('Registro carregado com sucesso.').build(model);
  }

  @Get('llm-jobs')
  async jobs(@CurrentUser() user: AuthenticatedUser) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.ai.listJobs(user.id));
  }

  @Get('llm-jobs/:id')
  async job(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    const job = await this.ai.findJob(id, user.id);
    if (!job) throw new NotFoundException('Job de geracao nao encontrado.');
    return this.response.withMessage('Registro carregado com sucesso.').build(job);
  }

  @Get('prompt-templates')
  async templates(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.ai.listPromptTemplates());
  }

  @Get('prompt-templates/:id')
  async template(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    requireAdmin(user);
    const template = await this.ai.findPromptTemplate(id);
    if (!template) throw new NotFoundException('Template de prompt nao encontrado.');
    return this.response.withMessage('Registro carregado com sucesso.').build(template);
  }
}
