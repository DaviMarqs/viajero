import { join } from 'node:path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DjangoDefaultsSubscriber } from './django-defaults.subscriber';

export const DEFAULT_DATABASE_URL = 'postgresql://postgres:1414@localhost:5432/viajero';
/** Tabela de controle das migrations do Nest (a do Django e django_migrations). */
export const MIGRATIONS_TABLE = 'nest_migrations';

// Em src/ (ts-node, jest) os arquivos sao .ts; em dist/ sao .js (sem pegar os .d.ts).
const EXTENSION = __filename.endsWith('.ts') ? 'ts' : 'js';

/** Opcoes comuns da API e da CLI (migrations, seed, fixtures). */
export function baseDatabaseOptions(url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  return {
    type: 'postgres' as const,
    url,
    synchronize: false,
    migrations: [join(__dirname, 'migrations', `*.${EXTENSION}`)],
    migrationsTableName: MIGRATIONS_TABLE,
    // Sem parseInt8: o TypeORM devolve ids bigint gerados como string (bugfix #720) e compara
    // relacoes por id ao salvar; misturar number e string faz ele "desvincular" filhos.
    // Os DTOs convertem ids recebidos como string (common/validation.ts).
    subscribers: [DjangoDefaultsSubscriber],
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}

/** Entidades para a CLI, que nao passa pelos modulos do Nest (a API usa autoLoadEntities). */
export const ENTITY_GLOBS = [join(__dirname, '..', 'modules', '**', `{entities,*.entity}.${EXTENSION}`)];

export function databaseConfig(): TypeOrmModuleOptions {
  return { ...baseDatabaseOptions(), autoLoadEntities: true };
}
