import 'reflect-metadata';
import { seedIfEmpty } from '../database/seed';
import { describeResult, log, runCli, withDataSource } from './database-cli';

/**
 * Deixa o banco pronto para a API: aplica as migrations pendentes do Nest e carrega o seed se ainda
 * nao houver destinos. Roda na subida do container (`node dist/cli/migrate-and-seed.js`) e no
 * `npm run start:dev` (via `npm run db:setup`).
 */
runCli(() =>
  withDataSource(async (dataSource) => {
    const applied = await dataSource.runMigrations();
    log(applied.length ? `${applied.length} migration(s) aplicada(s): ${applied.map(({ name }) => name).join(', ')}.` : 'Schema em dia.');
    const seeded = await seedIfEmpty(dataSource);
    if (!seeded) {
      log('Seed ja carregado (ha destinos no banco).');
      return;
    }
    log('Seed carregado:');
    describeResult(seeded).forEach((line) => log(line));
  }),
);
