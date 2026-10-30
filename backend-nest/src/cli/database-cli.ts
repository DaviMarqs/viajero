import { DataSource } from 'typeorm';
import { createDataSource } from '../database/data-source';
import { FixtureResult } from '../database/fixtures';

export const log = (message: string) => console.log(`[db] ${message}`);

/** Abre o DataSource da CLI (DATABASE_URL do ambiente ou de backend-nest/.env), roda e fecha. */
export async function withDataSource<T>(task: (dataSource: DataSource) => Promise<T>): Promise<T> {
  const dataSource = createDataSource();
  await dataSource.initialize();
  try {
    return await task(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

export async function schemaExists(dataSource: DataSource): Promise<boolean> {
  const rows: Array<{ exists: boolean }> = await dataSource.query("SELECT to_regclass('users_user') IS NOT NULL AS \"exists\"");
  return rows[0]?.exists === true;
}

export function describeResult(result: FixtureResult): string[] {
  const lines = Object.entries(result.tables).map(([table, total]) => `  ${table}: ${total}`);
  lines.push(...Object.entries(result.junctions).map(([table, total]) => `  ${table} (M2M): ${total}`));
  lines.push(...Object.entries(result.skippedModels).map(([model, total]) => `  ignorado (sem tabela no Nest): ${model} x${total}`));
  lines.push(...Object.entries(result.ignoredFields).map(([model, fields]) => `  campos sem coluna no Nest, nao importados: ${model} (${fields.join(', ')})`));
  lines.push(...result.truncated.map((value) => `  texto cortado no limite da coluna: ${value}`));
  return lines;
}

/** Termina o processo com codigo 1 mostrando a causa (inclui o detail do PostgreSQL). */
export function runCli(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    const { message, detail } = error as { message?: string; detail?: string };
    console.error(`[db] Erro: ${message ?? String(error)}${detail ? `\n[db] ${detail}` : ''}`);
    process.exit(1);
  });
}
