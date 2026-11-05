import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DjangoFixtureRecord, loadFixtures, parseFixture } from '../database/fixtures';
import { describeResult, log, runCli, schemaExists, withDataSource } from './database-cli';

const USAGE = 'npm run fixtures:load -- <arquivo.json> [outro.json] [--skip-unknown] [--truncate]';
const FLAGS = new Set(['--skip-unknown', '--truncate']);

/**
 * Importa um ou mais JSON do `manage.py dumpdata` (modelos da aplicacao) no banco do DATABASE_URL.
 * Uso: npm run fixtures:load -- <arquivo.json> [outro.json] [--skip-unknown] [--truncate]
 * --skip-unknown: ignora modelos sem tabela no Nest (contenttypes, sessions...) em vez de abortar.
 * --truncate: corta textos maiores que o varchar da coluna (dados vindos do SQLite) em vez de abortar.
 * Grava por PK (insere ou atualiza), tudo numa transacao; acerta as sequences no fim.
 */
runCli(async () => {
  const args = process.argv.slice(2);
  const unknownFlags = args.filter((arg) => arg.startsWith('--') && !FLAGS.has(arg));
  if (unknownFlags.length) throw new Error(`Opcao desconhecida: ${unknownFlags.join(', ')}. Uso: ${USAGE}`);
  const files = args.filter((arg) => !arg.startsWith('--'));
  if (!files.length) throw new Error(`Informe o arquivo. Uso: ${USAGE}`);

  const records: DjangoFixtureRecord[] = [];
  for (const file of files) {
    // INIT_CWD: pasta de onde o `npm run` foi chamado (o npm troca o cwd para backend-nest/).
    const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
    records.push(...parseFixture(await readFile(path, 'utf8'), path));
  }

  await withDataSource(async (dataSource) => {
    if (!(await schemaExists(dataSource))) throw new Error('Banco sem tabelas. Rode `npm run migration:run` antes.');
    const result = await loadFixtures(dataSource, records, {
      skipUnknownModels: args.includes('--skip-unknown'),
      truncateLongText: args.includes('--truncate'),
    });
    log(`${records.length} registro(s) de ${files.length} arquivo(s) importado(s):`);
    describeResult(result).forEach((line) => log(line));
  });
});
