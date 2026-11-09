import { DataSource, EntityManager, EntityMetadata } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { resolveColumnDefault } from './django-defaults.subscriber';

/**
 * Importa fixtures no formato do `manage.py dumpdata` do Django (mesmo formato do seed) usando o
 * metadata das entidades do TypeORM:
 * - modelo `app.model` -> tabela `app_model`;
 * - campo FK `user` -> coluna `user_id`;
 * - lista de um M2M (ex.: `tags`) -> linhas na tabela de juncao, substituindo as atuais (como o `.set()` do Django);
 * - campo ausente -> default do modelo, como o `loaddata` faz.
 * Grava por PK (insere ou atualiza) numa transacao e acerta as sequences no fim.
 */

export interface DjangoFixtureRecord {
  model: string;
  pk?: unknown;
  fields: Record<string, unknown>;
}

export interface FixtureOptions {
  /** Ignora (e conta) modelos sem entidade no Nest em vez de abortar. */
  skipUnknownModels?: boolean;
  /**
   * Corta no limite da coluna textos maiores que o varchar (o SQLite nao valida tamanho, o
   * PostgreSQL recusa). Sem isso, o import aborta listando os valores.
   */
  truncateLongText?: boolean;
  now?: Date;
}

export interface TablePlan {
  table: string;
  model: string;
  /** Primeira coluna e a PK. */
  columns: string[];
  rows: unknown[][];
}

export interface JunctionPlan {
  table: string;
  ownerColumn: string;
  inverseColumn: string;
  ownerIds: unknown[];
  pairs: Array<[unknown, unknown]>;
}

export interface FixturePlan {
  tables: TablePlan[];
  junctions: JunctionPlan[];
  /** Modelos ignorados com --skip-unknown e quantos registros cada um tinha. */
  skippedModels: Record<string, number>;
  /** Campos com valor que nao tem coluna no Nest (ex.: users.user.groups). */
  ignoredFields: Record<string, string[]>;
  /** Textos cortados com truncateLongText ("modelo pk=1 coluna: 51 > 50"). */
  truncated: string[];
}

export type FixtureResult = Omit<FixturePlan, 'tables' | 'junctions'> & {
  tables: Record<string, number>;
  junctions: Record<string, number>;
};

export class FixtureError extends Error {}

const NATURAL_KEYS_HINT = 'chaves naturais nao sao suportadas; gere o dump sem --natural-primary/--natural-foreign';
// Limite de parametros do PostgreSQL por comando e 65535.
const MAX_PARAMETERS = 60_000;

interface ManyToManyMapping {
  table: string;
  ownerColumn: string;
  inverseColumn: string;
}

interface ModelMapping {
  table: string;
  primary: ColumnMetadata;
  columns: ColumnMetadata[];
  byName: Map<string, ColumnMetadata>;
  manyToMany: Map<string, ManyToManyMapping>;
}

/** `destinations.pointofinterest` -> `destinations_pointofinterest` (padrao do Django). */
export function modelTable(model: string): string {
  return model.toLowerCase().replace('.', '_');
}

export function parseFixture(content: string, source = 'fixture'): DjangoFixtureRecord[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new FixtureError(`${source}: JSON invalido (${(error as Error).message})`);
  }
  if (!Array.isArray(data)) throw new FixtureError(`${source}: esperado um array de registros do dumpdata`);
  data.forEach((item: unknown, index) => {
    const record = item as Partial<DjangoFixtureRecord> | null;
    const valid =
      record !== null &&
      typeof record === 'object' &&
      typeof record.model === 'string' &&
      record.model.includes('.') &&
      record.fields !== null &&
      typeof record.fields === 'object' &&
      !Array.isArray(record.fields);
    if (!valid) throw new FixtureError(`${source}: registro #${index + 1} fora do formato {model: "app.modelo", pk, fields: {...}}`);
  });
  return data as DjangoFixtureRecord[];
}

function buildMapping(metadata: EntityMetadata): ModelMapping {
  if (metadata.primaryColumns.length !== 1) {
    throw new FixtureError(`${metadata.tableName}: so tabelas com PK de uma coluna sao suportadas`);
  }
  // As colunas de FK (user_id...) sao "virtual" no TypeORM (sem propriedade propria), mas existem no banco.
  const columns = metadata.columns.filter((column) => !column.isPrimary && !column.isVirtualProperty);
  const manyToMany = new Map<string, ManyToManyMapping>();
  for (const relation of metadata.manyToManyRelations) {
    const junction = relation.junctionEntityMetadata;
    if (!relation.isOwning || !junction) continue;
    const mapping = {
      table: junction.tableName,
      ownerColumn: relation.joinColumns[0].databaseName,
      inverseColumn: relation.inverseJoinColumns[0].databaseName,
    };
    manyToMany.set(relation.propertyName, mapping);
    // Nome do campo no Django = sufixo da tabela de juncao (destinations_pointofinterest_tags -> tags).
    const prefix = `${metadata.tableName}_`;
    if (junction.tableName.startsWith(prefix)) manyToMany.set(junction.tableName.slice(prefix.length), mapping);
  }
  return {
    table: metadata.tableName,
    primary: metadata.primaryColumns[0],
    columns,
    byName: new Map(columns.map((column) => [column.databaseName, column])),
    manyToMany,
  };
}

function isScalarKey(value: unknown): boolean {
  return (typeof value === 'number' || typeof value === 'string') && value !== '';
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

const TEXT_TYPES = new Set(['varchar', 'character varying', 'char', 'character']);

/** Tamanho maximo de um varchar(n), contado em caracteres como no PostgreSQL. */
function maxLength(column: ColumnMetadata): number {
  return typeof column.type === 'string' && TEXT_TYPES.has(column.type) ? Number(column.length) || 0 : 0;
}

function toDatabaseValue(column: ColumnMetadata, value: unknown): unknown {
  if (column.type === 'json' || column.type === 'jsonb') {
    // O JSONField NOT NULL do Django grava None como o JSON null.
    return value === null && column.isNullable ? null : JSON.stringify(value);
  }
  return value;
}

/** Monta as linhas de cada tabela sem tocar no banco (puro, testavel). */
export function planFixture(metadatas: EntityMetadata[], records: DjangoFixtureRecord[], options: FixtureOptions = {}): FixturePlan {
  const now = options.now ?? new Date();
  const entities = new Map(metadatas.filter((metadata) => metadata.tableType !== 'junction').map((metadata) => [metadata.tableName, metadata]));
  const mappings = new Map<string, ModelMapping>();
  const tables = new Map<string, { plan: TablePlan; rows: Map<string, unknown[]> }>();
  const junctions = new Map<string, { mapping: ManyToManyMapping; owners: Map<string, { owner: unknown; targets: unknown[] }> }>();
  const unknownModels = new Set<string>();
  const skippedModels: Record<string, number> = {};
  const ignoredFields = new Map<string, Set<string>>();
  const tooLong: string[] = [];

  records.forEach((record, index) => {
    const model = record.model.toLowerCase();
    const metadata = entities.get(modelTable(model));
    if (!metadata) {
      if (options.skipUnknownModels) skippedModels[model] = (skippedModels[model] ?? 0) + 1;
      else unknownModels.add(model);
      return;
    }
    let mapping = mappings.get(metadata.tableName);
    if (!mapping) {
      mapping = buildMapping(metadata);
      mappings.set(metadata.tableName, mapping);
    }
    const pk = record.pk;
    if (!isScalarKey(pk)) throw new FixtureError(`${model}: registro #${index + 1} sem pk (${NATURAL_KEYS_HINT})`);
    const where = `${model} pk=${String(pk)}`;

    const values = new Map<string, unknown>();
    for (const [field, value] of Object.entries(record.fields)) {
      const m2m = mapping.manyToMany.get(field);
      if (m2m) {
        if (!Array.isArray(value) || !value.every(isScalarKey)) throw new FixtureError(`${where}: "${field}" deve ser uma lista de ids (${NATURAL_KEYS_HINT})`);
        let junction = junctions.get(m2m.table);
        if (!junction) {
          junction = { mapping: m2m, owners: new Map() };
          junctions.set(m2m.table, junction);
        }
        junction.owners.set(String(pk), { owner: pk, targets: [...new Set(value)] });
        continue;
      }
      const column = mapping.byName.get(field) ?? mapping.byName.get(`${field}_id`);
      if (!column) {
        if (!isEmpty(value)) {
          const ignored = ignoredFields.get(model) ?? new Set<string>();
          ignored.add(field);
          ignoredFields.set(model, ignored);
        }
        continue;
      }
      if (column.relationMetadata && value !== null && !isScalarKey(value)) {
        throw new FixtureError(`${where}: "${field}" deve ser um id (${NATURAL_KEYS_HINT})`);
      }
      const limit = maxLength(column);
      const characters = typeof value === 'string' ? [...value] : [];
      if (limit && characters.length > limit) {
        tooLong.push(`${where} ${column.databaseName}: ${characters.length} > ${limit}`);
        values.set(column.databaseName, characters.slice(0, limit).join(''));
        continue;
      }
      values.set(column.databaseName, value);
    }

    const row = mapping.columns.map((column) => {
      if (values.has(column.databaseName)) return toDatabaseValue(column, values.get(column.databaseName));
      const fallback = resolveColumnDefault(column, now);
      if (fallback !== undefined) return toDatabaseValue(column, fallback);
      if (column.isNullable) return null;
      throw new FixtureError(`${where}: campo obrigatorio "${column.databaseName}" ausente e sem default`);
    });

    let table = tables.get(mapping.table);
    if (!table) {
      table = {
        plan: { table: mapping.table, model, columns: [mapping.primary.databaseName, ...mapping.columns.map((column) => column.databaseName)], rows: [] },
        rows: new Map(),
      };
      tables.set(mapping.table, table);
    }
    // PK repetida: vale o ultimo registro, como no loaddata.
    table.rows.set(String(pk), [pk, ...row]);
  });

  if (unknownModels.size) {
    throw new FixtureError(
      `Modelo(s) sem tabela no Nest: ${[...unknownModels].sort().join(', ')}. ` +
        'Gere o dump so com os apps da aplicacao (users destinations profiles itineraries ai audit) ou use --skip-unknown.',
    );
  }
  if (tooLong.length && !options.truncateLongText) {
    throw new FixtureError(
      `Texto(s) maiores que a coluna (o SQLite nao valida o tamanho, o PostgreSQL recusa):\n  ${tooLong.join('\n  ')}\n` +
        'Corrija no arquivo ou use --truncate para cortar no limite da coluna.',
    );
  }

  return {
    tables: [...tables.values()].map(({ plan, rows }) => ({ ...plan, rows: [...rows.values()] })),
    junctions: [...junctions.values()].map(({ mapping, owners }) => ({
      ...mapping,
      ownerIds: [...owners.values()].map(({ owner }) => owner),
      pairs: [...owners.values()].flatMap(({ owner, targets }) => targets.map((target): [unknown, unknown] => [owner, target])),
    })),
    skippedModels,
    ignoredFields: Object.fromEntries([...ignoredFields].map(([model, fields]) => [model, [...fields].sort()])),
    truncated: tooLong,
  };
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

async function insertRows(manager: EntityManager, table: string, columns: string[], rows: unknown[][], conflict: string): Promise<void> {
  for (const batch of chunk(rows, Math.max(1, Math.floor(MAX_PARAMETERS / columns.length)))) {
    const parameters: unknown[] = [];
    const values = batch.map((row) => `(${row.map((value) => `$${parameters.push(value)}`).join(', ')})`);
    await manager.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES ${values.join(', ')} ${conflict}`, parameters);
  }
}

/** Acerta as sequences (identity/serial) pelo maior id, como o loaddata do Django. */
export async function resetSequences(manager: EntityManager, tables: Iterable<string>): Promise<void> {
  for (const table of new Set(tables)) {
    const columns: Array<{ column_name: string }> = await manager.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1 AND (is_identity = 'YES' OR column_default LIKE 'nextval(%')`,
      [table],
    );
    for (const { column_name: column } of columns) {
      await manager.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE(MAX(${quote(column)}), 1), MAX(${quote(column)}) IS NOT NULL) FROM ${quote(table)}`,
        [quote(table), column],
      );
    }
  }
}

export async function applyFixturePlan(manager: EntityManager, plan: FixturePlan): Promise<void> {
  // FKs do schema sao DEFERRABLE: a ordem dos registros no arquivo nao importa, a checagem e no COMMIT.
  await manager.query('SET CONSTRAINTS ALL DEFERRED');
  for (const { table, columns, rows } of plan.tables) {
    const [primary, ...rest] = columns;
    const update = rest.length ? `DO UPDATE SET ${rest.map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`).join(', ')}` : 'DO NOTHING';
    await insertRows(manager, table, columns, rows, `ON CONFLICT (${quote(primary)}) ${update}`);
  }
  for (const junction of plan.junctions) {
    await manager.query(`DELETE FROM ${quote(junction.table)} WHERE ${quote(junction.ownerColumn)} = ANY($1)`, [junction.ownerIds]);
    await insertRows(manager, junction.table, [junction.ownerColumn, junction.inverseColumn], junction.pairs, 'ON CONFLICT DO NOTHING');
  }
  await resetSequences(manager, [...plan.tables.map(({ table }) => table), ...plan.junctions.map(({ table }) => table)]);
}

export function summarizePlan(plan: FixturePlan): FixtureResult {
  return {
    tables: Object.fromEntries(plan.tables.map(({ table, rows }) => [table, rows.length])),
    junctions: Object.fromEntries(plan.junctions.map(({ table, pairs }) => [table, pairs.length])),
    skippedModels: plan.skippedModels,
    ignoredFields: plan.ignoredFields,
    truncated: plan.truncated,
  };
}

export async function loadFixtures(dataSource: DataSource, records: DjangoFixtureRecord[], options: FixtureOptions = {}): Promise<FixtureResult> {
  const plan = planFixture(dataSource.entityMetadatas, records, options);
  await dataSource.transaction((manager) => applyFixturePlan(manager, plan));
  return summarizePlan(plan);
}
