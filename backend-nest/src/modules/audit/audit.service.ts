import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { ListQueryOptions, PaginatedList, parseListQuery, runListQuery } from '../../common/query/list-query';
import { ListRequestContext } from '../../common/query/list-request.decorator';

export interface AuditInput {
  event_type: string;
  actor_id?: number | null;
  content_type?: string;
  object_id?: string;
  metadata?: Record<string, unknown>;
}

const LIST_LIMIT = 100;

/** Mesmos campos do AuditLogViewSet do Django. */
export const AUDIT_LIST_OPTIONS: ListQueryOptions = {
  filters: { event_type: { column: 'event_type' }, content_type: { column: 'content_type' } },
  orderingFields: ['created_at'],
  defaultOrdering: ['-created_at'],
};

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async log(input: AuditInput): Promise<AuditLog> {
    const entity = this.logs.create({
      event_type: input.event_type,
      actor: input.actor_id ? ({ id: input.actor_id } as never) : null,
      content_type: input.content_type ?? '',
      object_id: input.object_id ?? '',
      metadata: input.metadata ?? {},
    });
    return this.logs.save(entity);
  }

  /** Sem `page` continua devolvendo os 100 mais recentes. */
  list(request: ListRequestContext): Promise<AuditLog[] | PaginatedList<AuditLog>> {
    return runListQuery({
      qb: this.logs.createQueryBuilder('log'),
      query: parseListQuery(request.query, AUDIT_LIST_OPTIONS),
      options: AUDIT_LIST_OPTIONS,
      url: request.url,
      present: (rows) => rows,
      unpaginatedLimit: LIST_LIMIT,
    });
  }

  async findOne(id: number): Promise<AuditLog> {
    const log = await this.logs.findOne({ where: { id } });
    if (!log) throw new NotFoundException('Registro de auditoria nao encontrado.');
    return log;
  }
}
