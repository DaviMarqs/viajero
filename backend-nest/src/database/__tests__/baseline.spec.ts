import { EntityMetadata } from 'typeorm';
import { BASELINE_CREATE_TABLES, BASELINE_TABLES } from '../migrations/1793275200000-Baseline';
import { loadEntityMetadatas } from './entity-metadata';

// Divergencias conhecidas entre entidade e schema (a entidade nao e usada pela API hoje).
// RefreshToken.user nao tem @JoinColumn({ name: 'user_id' }), entao o TypeORM espera "userId".
const KNOWN_COLUMN_GAPS = new Set(['users_refreshtoken.userId']);

function baselineColumns(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  for (const sql of BASELINE_CREATE_TABLES) {
    const [, table, body] = /^CREATE TABLE (\w+) \(\n([\s\S]*)\n\s*\)$/.exec(sql) ?? [];
    const columns = body
      .split(',\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((name) => name !== 'CONSTRAINT');
    tables.set(table, new Set(columns));
  }
  return tables;
}

describe('migration baseline', () => {
  let metadatas: EntityMetadata[];
  beforeAll(async () => {
    metadatas = await loadEntityMetadatas();
  });

  it('cria uma tabela para cada entidade (inclusive a juncao de tags) e nenhuma a mais', () => {
    const entityTables = metadatas.map((metadata) => metadata.tableName).sort();
    expect(entityTables).toEqual([...BASELINE_TABLES].sort());
    expect([...baselineColumns().keys()].sort()).toEqual([...BASELINE_TABLES].sort());
  });

  it('tem todas as colunas mapeadas pelas entidades', () => {
    const tables = baselineColumns();
    const missing = metadatas.flatMap((metadata) =>
      metadata.columns
        .map((column) => `${metadata.tableName}.${column.databaseName}`)
        .filter((name) => !tables.get(name.split('.')[0])?.has(name.split('.')[1])),
    );
    expect(missing.filter((name) => !KNOWN_COLUMN_GAPS.has(name))).toEqual([]);
  });
});
