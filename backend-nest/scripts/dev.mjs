#!/usr/bin/env node
// `npm run start:dev`: deixa o banco pronto e sobe o Nest em modo watch.
// 1. PostgreSQL: se o DATABASE_URL local nao responde, sobe o servico `db` do docker-compose.yml da raiz
//    (container `viajero-pg`).
//    Com PostgreSQL instalado na maquina e respondendo, o Docker nao e usado.
// 2. Schema: aplica as migrations do Django (dono do schema) e carrega o seed se o banco estiver vazio.
// 3. Inicia `nest start --watch` conectado a esse banco.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_DJANGO = join(ROOT, '..', 'backend');
const COMPOSE_FILE = join(ROOT, '..', 'docker-compose.yml');
dotenv.config({ path: join(ROOT, '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:1414@localhost:5432/viajero';
const CONTAINER = process.env.DEV_DB_CONTAINER || 'viajero-pg';
const VOLUME = process.env.DEV_DB_VOLUME || 'viajero-pgdata';
const db = new URL(DATABASE_URL);
const dbName = decodeURIComponent(db.pathname.replace(/^\//, '')) || 'postgres';
const dbPort = db.port || '5432';
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(db.hostname);

const log = (message) => console.log(`[dev] ${message}`);
const fail = (message) => {
  console.error(`[dev] ${message}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(database = dbName) {
  const url = new URL(DATABASE_URL);
  url.pathname = `/${encodeURIComponent(database)}`;
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', shell: false, ...options });
}

const hasCommand = (command, args = ['--version']) => {
  const result = run(command, args);
  return !result.error && result.status === 0;
};

function startDockerPostgres() {
  if (!hasCommand('docker', ['info'])) {
    fail(
      `PostgreSQL nao responde em ${db.hostname}:${dbPort} e o Docker nao esta disponivel. ` +
        'Inicie o Docker (ou o seu PostgreSQL) e rode de novo.',
    );
  }
  const inspect = run('docker', ['inspect', '-f', '{{.State.Status}} {{index .Config.Labels "com.docker.compose.project"}}', CONTAINER]);
  const [state = '', label = ''] = (inspect.status === 0 ? inspect.stdout.trim() : '').split(' ');
  const fromCompose = label !== '' && label !== '<no value>';
  if (state === 'running') {
    fail(`O container ${CONTAINER} esta rodando, mas ${db.hostname}:${dbPort} nao responde. Confira a porta no DATABASE_URL (backend-nest/.env).`);
  }
  // Container antigo criado com `docker run` (antes do docker-compose): so liga.
  if (state && !fromCompose) {
    log(`Ligando o container ${CONTAINER}...`);
    const started = run('docker', ['start', CONTAINER]);
    if (started.status !== 0) fail(`Nao foi possivel iniciar ${CONTAINER}: ${started.stderr.trim()}`);
    return;
  }
  // Mesmo banco do `docker compose up` da raiz (container viajero-pg, volume viajero-pgdata).
  if (existsSync(COMPOSE_FILE) && hasCommand('docker', ['compose', 'version'])) {
    log('Subindo o banco (servico db do docker-compose.yml)...');
    const up = run('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', 'db'], { env: { ...process.env, DB_PORT: dbPort }, stdio: ['ignore', 'inherit', 'inherit'] });
    if (up.status !== 0) fail('Nao foi possivel subir o banco com docker compose.');
    return;
  }
  log(`Criando o container ${CONTAINER} (postgres:16, volume ${VOLUME}, porta ${dbPort})...`);
  const created = run('docker', [
    'run', '-d', '--name', CONTAINER,
    '-e', `POSTGRES_USER=${decodeURIComponent(db.username || 'postgres')}`,
    '-e', `POSTGRES_PASSWORD=${decodeURIComponent(db.password)}`,
    '-e', `POSTGRES_DB=${dbName}`,
    '-p', `${dbPort}:5432`,
    '-v', `${VOLUME}:/var/lib/postgresql/data`,
    'postgres:16',
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  if (created.status !== 0) fail(`Nao foi possivel criar o container ${CONTAINER}.`);
}

/** Conecta no banco do DATABASE_URL; liga o Docker ou cria o database quando preciso. */
async function ensureDatabase() {
  let dockerStarted = false;
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const client = await connect();
      log(`PostgreSQL conectado em ${db.hostname}:${dbPort}/${dbName}.`);
      return client;
    } catch (error) {
      const code = error.code ?? '';
      if (code === '3D000') {
        // Servidor no ar, mas sem o database (ex.: PostgreSQL instalado na maquina).
        log(`Criando o database ${dbName}...`);
        const admin = await connect('postgres');
        await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
        await admin.end();
        continue;
      }
      const notUp = ['ECONNREFUSED', 'ECONNRESET', '57P03'].includes(code) || /terminated|starting up|timeout/i.test(error.message);
      if (!notUp) fail(`Falha ao conectar no PostgreSQL (${code || 'erro'}): ${error.message}. Confira o DATABASE_URL em backend-nest/.env.`);
      if (!isLocal) fail(`PostgreSQL remoto ${db.hostname}:${dbPort} nao responde: ${error.message}`);
      if (!dockerStarted) {
        startDockerPostgres();
        dockerStarted = true;
        log('Aguardando o PostgreSQL aceitar conexoes...');
      }
      if (Date.now() > deadline) fail(`O PostgreSQL nao respondeu em 90 s. Veja "docker logs ${CONTAINER}".`);
      await sleep(1000);
    }
  }
}

function djangoManage(args, label) {
  const result = run('uv', ['run', 'manage.py', ...args], {
    cwd: BACKEND_DJANGO,
    env: { ...process.env, DATABASE_URL },
  });
  if (result.error || result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    fail(`${label} falhou. Rode manualmente em backend/: uv run manage.py ${args.join(' ')}`);
  }
  return result.stdout ?? '';
}

/** O Django e o dono do schema: aplica migrations pendentes e carrega o seed num banco vazio. */
async function ensureSchema(client) {
  const canMigrate = existsSync(join(BACKEND_DJANGO, 'manage.py')) && hasCommand('uv');
  const { rows } = await client.query("select to_regclass('public.users_user') is not null as ready");
  if (!canMigrate) {
    if (!rows[0].ready) fail('Banco sem tabelas e o `uv` nao foi encontrado. Instale o uv e rode de novo (as migrations vem do Django em backend/).');
    log('uv nao encontrado: migrations do Django nao conferidas.');
    return;
  }
  log(rows[0].ready ? 'Conferindo migrations do Django...' : 'Banco vazio: criando as tabelas pelas migrations do Django...');
  const output = djangoManage(['migrate', '--noinput'], 'Migrations do Django');
  const applied = (output.match(/Applying .* OK/g) ?? []).length;
  log(applied ? `${applied} migration(s) aplicada(s).` : 'Schema em dia.');

  const { rows: destinations } = await client.query('select count(*)::int as total from destinations_destination');
  if (destinations[0].total === 0) {
    log('Sem destinos: carregando o seed (seed_data.json)...');
    djangoManage(['loaddata', 'seed_data.json'], 'Seed');
    log('Seed carregado.');
  }
}

const client = await ensureDatabase();
try {
  await ensureSchema(client);
} finally {
  await client.end();
}

log('Iniciando o Nest em modo watch...');
// Fora do Windows o Nest roda num grupo de processos proprio: ao encerrar este script (Ctrl+C ou
// "stop" da IDE), o grupo inteiro cai junto, inclusive a API que o watch do Nest sobe como filho.
const posix = process.platform !== 'win32';
const nest = spawn(process.execPath, [join(ROOT, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'), 'start', '--watch'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL },
  detached: posix,
});
const stopNest = (signal = 'SIGTERM') => {
  try {
    if (posix) process.kill(-nest.pid, signal);
    else nest.kill(signal);
  } catch {
    // ja encerrado
  }
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stopNest(signal === 'SIGHUP' ? 'SIGTERM' : signal));
process.on('exit', () => stopNest());
nest.on('exit', (code, signal) => process.exit(signal ? 0 : (code ?? 0)));
