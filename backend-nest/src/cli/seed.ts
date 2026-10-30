import 'reflect-metadata';
import { seedIfEmpty } from '../database/seed';
import { describeResult, log, runCli, schemaExists, withDataSource } from './database-cli';

/** `npm run seed`: carrega seed/seed_data.json se ainda nao houver destinos. */
runCli(() =>
  withDataSource(async (dataSource) => {
    if (!(await schemaExists(dataSource))) throw new Error('Banco sem tabelas. Rode `npm run migration:run` antes.');
    const seeded = await seedIfEmpty(dataSource);
    if (!seeded) {
      log('Seed ja carregado (ha destinos no banco); nada a fazer.');
      return;
    }
    log('Seed carregado:');
    describeResult(seeded).forEach((line) => log(line));
  }),
);
