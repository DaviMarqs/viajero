import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/staff.guard';
import { AuditService } from './audit.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';
import { ListRequest, ListRequestContext } from '../../common/query/list-request.decorator';

/** So staff, como o IsAdminUser do Django (antes o Nest devolvia 200 com lista vazia). */
@Controller('api/audit-logs')
@UseGuards(JwtAuthGuard, StaffGuard)
export class AuditController {
  constructor(private readonly audit: AuditService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@ListRequest() request: ListRequestContext) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.audit.list(request));
  }

  @Get(':id')
  async retrieve(@Param('id', ParseIntPipe) id: number) {
    return this.response.withMessage('Registro carregado com sucesso.').build(await this.audit.findOne(id));
  }
}
