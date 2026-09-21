import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AuditService } from './audit.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    if (!user.is_staff && !user.is_superuser) {
      return this.response.withMessage('Lista carregada com sucesso.').build([]);
    }
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.audit.list());
  }
}
