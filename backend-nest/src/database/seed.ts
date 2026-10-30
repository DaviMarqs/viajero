import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { FixtureResult, loadFixtures, parseFixture } from './fixtures';

/** backend-nest/seed/seed_data.json (src/database ou dist/database ficam dois niveis abaixo). */
export const SEED_FILE = join(__dirname, '..', '..', 'seed', 'seed_data.json');

/**
 * Carrega o seed (destinos, perfis de custo, tags e POIs) so quando ainda nao ha destinos,
 * como o `migrate-and-seed.sh` do Django fazia. Devolve null quando o banco ja tem dados.
 */
export async function seedIfEmpty(dataSource: DataSource, file = SEED_FILE): Promise<FixtureResult | null> {
  const rows: Array<{ total: number }> = await dataSource.query('SELECT count(*)::int AS total FROM destinations_destination');
  if (rows[0].total > 0) return null;
  const records = parseFixture(await readFile(file, 'utf8'), file);
  return loadFixtures(dataSource, records);
}
