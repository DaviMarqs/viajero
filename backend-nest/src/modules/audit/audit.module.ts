import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, ApiResponseBuilder],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
