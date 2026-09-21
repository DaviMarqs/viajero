import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface AuditInput {
  event_type: string;
  actor_id?: number | null;
  content_type?: string;
  object_id?: string;
  metadata?: Record<string, unknown>;
}

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

  list(): Promise<AuditLog[]> {
    return this.logs.find({ order: { created_at: 'DESC' }, take: 100 });
  }
}
