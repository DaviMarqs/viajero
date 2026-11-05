import 'reflect-metadata';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { baseDatabaseOptions, ENTITY_GLOBS } from './typeorm.config';

// backend-nest/.env (src/database ou dist/database ficam dois niveis abaixo). Variaveis ja
// definidas no ambiente (docker-compose, CI) tem prioridade.
loadEnv({ path: join(__dirname, '..', '..', '.env') });

/** DataSource fora do Nest: CLI do TypeORM (migration:*), seed e fixtures:load. */
export function createDataSource(url?: string): DataSource {
  return new DataSource({ ...baseDatabaseOptions(url), entities: ENTITY_GLOBS });
}

// A CLI do TypeORM (`-d src/database/data-source.ts` ou `-d dist/database/data-source.js`)
// exige exatamente uma instancia de DataSource exportada.
export default createDataSource();
