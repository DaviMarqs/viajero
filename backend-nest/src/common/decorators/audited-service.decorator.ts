import { AuditService } from '../../modules/audit/audit.service';

export interface AuditableOperation<TArgs extends unknown[], TResult> {
  execute(...args: TArgs): Promise<TResult>;
}

export class AuditedServiceDecorator<TArgs extends unknown[], TResult> implements AuditableOperation<TArgs, TResult> {
  constructor(
    private readonly wrapped: AuditableOperation<TArgs, TResult>,
    private readonly auditService: AuditService,
    private readonly eventType: string,
    private readonly actorResolver: (args: TArgs, result: TResult) => number | null,
    private readonly metadataResolver: (args: TArgs, result: TResult) => Record<string, unknown> = () => ({}),
  ) {}

  async execute(...args: TArgs): Promise<TResult> {
    const result = await this.wrapped.execute(...args);
    await this.auditService.log({
      event_type: this.eventType,
      actor_id: this.actorResolver(args, result),
      content_type: result?.constructor?.name ?? '',
      object_id: typeof result === 'object' && result !== null && 'id' in result ? String(result.id) : '',
      metadata: this.metadataResolver(args, result),
    });
    return result;
  }
}
