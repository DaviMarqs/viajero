import { EntitySubscriberInterface, EventSubscriber, InsertEvent, ObjectLiteral } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';

const TIMESTAMP_DEFAULTS = new Set(['CURRENT_TIMESTAMP', 'NOW()']);

/**
 * Valor que o Django gravaria numa coluna omitida no INSERT.
 * As migrations do Django nao criam DEFAULT no banco (o Django aplica os
 * defaults em Python), entao o DEFAULT que o TypeORM envia vira NULL.
 */
export function resolveColumnDefault(
  column: Pick<ColumnMetadata, 'default' | 'isCreateDate' | 'isUpdateDate'>,
  now: Date = new Date(),
): unknown {
  if (column.isCreateDate || column.isUpdateDate) return new Date(now);
  const raw: unknown = typeof column.default === 'function' ? (column.default as () => unknown)() : column.default;
  if (typeof raw !== 'string') return raw;
  if (TIMESTAMP_DEFAULTS.has(raw.trim().toUpperCase())) return new Date(now);
  const quoted = /^'(.*)'$/s.exec(raw);
  if (!quoted) return raw;
  try {
    return JSON.parse(quoted[1]) as unknown;
  } catch {
    return quoted[1];
  }
}

export function applyDjangoDefaults(columns: ColumnMetadata[], entity: ObjectLiteral | undefined, now: Date = new Date()): void {
  if (!entity) return;
  for (const column of columns) {
    if (column.isGenerated || column.isVirtual || column.relationMetadata) continue;
    if (column.getEntityValue(entity) !== undefined) continue;
    const value = resolveColumnDefault(column, now);
    if (value !== undefined) column.setEntityValue(entity, value);
  }
}

/** Funciona para todo `repository.save()`; inserts via QueryBuilder.insert() nao passam por aqui. */
@EventSubscriber()
export class DjangoDefaultsSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<ObjectLiteral>): void {
    applyDjangoDefaults(event.metadata.columns, event.entity);
  }
}
