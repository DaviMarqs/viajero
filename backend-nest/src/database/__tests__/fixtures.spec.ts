import { readFileSync } from 'node:fs';
import { EntityMetadata } from 'typeorm';
import { DjangoFixtureRecord, FixtureError, FixturePlan, modelTable, parseFixture, planFixture } from '../fixtures';
import { SEED_FILE } from '../seed';
import { loadEntityMetadatas } from './entity-metadata';

const NOW = new Date('2026-10-29T12:00:00.000Z');

function rowsOf(plan: FixturePlan, table: string): Array<Record<string, unknown>> {
  const found = plan.tables.find((item) => item.table === table);
  if (!found) throw new Error(`tabela ${table} fora do plano`);
  return found.rows.map((row) => Object.fromEntries(found.columns.map((column, index) => [column, row[index]])));
}

describe('fixtures (dumpdata do Django)', () => {
  let metadatas: EntityMetadata[];
  const plan = (records: DjangoFixtureRecord[], skipUnknownModels = false) => planFixture(metadatas, records, { now: NOW, skipUnknownModels });

  beforeAll(async () => {
    metadatas = await loadEntityMetadatas();
  });

  it('converte o rotulo do modelo no nome da tabela do Django', () => {
    expect(modelTable('destinations.PointOfInterest')).toBe('destinations_pointofinterest');
  });

  it('rejeita arquivo fora do formato do dumpdata', () => {
    expect(() => parseFixture('{', 'a.json')).toThrow(/a\.json: JSON invalido/);
    expect(() => parseFixture('{"model": "users.user"}')).toThrow(/array de registros/);
    expect(() => parseFixture('[{"model": "users.user"}]')).toThrow(/registro #1 fora do formato/);
  });

  it('mapeia FK para <campo>_id, M2M para a juncao, JSON e defaults do modelo', () => {
    const result = plan([
      {
        model: 'destinations.pointofinterest',
        pk: 7,
        fields: { destination: 3, name: 'Museu', slug: 'museu', poi_type: 'museum', metadata: { tags: ['arte'] }, tags: [2, 5, 2] },
      },
    ]);
    const [poi] = rowsOf(result, 'destinations_pointofinterest');
    expect(poi).toMatchObject({ id: 7, destination_id: 3, name: 'Museu', metadata: '{"tags":["arte"]}' });
    // Campos ausentes recebem o default do modelo, como no loaddata.
    expect(poi).toMatchObject({ summary: '', price_level: 1, rating: 0, estimated_visit_minutes: 90 });
    expect(result.junctions).toEqual([
      { table: 'destinations_pointofinterest_tags', ownerColumn: 'pointofinterest_id', inverseColumn: 'poitag_id', ownerIds: [7], pairs: [[7, 2], [7, 5]] },
    ]);
  });

  it('preenche datas automaticas ausentes, mantem nulos e usa o ultimo registro de uma PK repetida', () => {
    const result = plan([
      { model: 'destinations.destination', pk: 1, fields: { slug: 'a', name: 'A', country: 'BR', created_by: null } },
      { model: 'destinations.destination', pk: 1, fields: { slug: 'b', name: 'B', country: 'BR', created_by: 4, metadata: null } },
    ]);
    const rows = rowsOf(result, 'destinations_destination');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: 'b', created_by_id: 4, created_at: NOW, updated_at: NOW, metadata: 'null' });
    expect(plan([{ model: 'destinations.destination', pk: 2, fields: { slug: 'c', name: 'C', country: 'BR' } }]).tables[0].rows[0]).toContain(null);
  });

  it('aborta com a lista de modelos sem tabela no Nest, ou ignora com skipUnknownModels', () => {
    const records = [
      { model: 'sessions.session', pk: 'abc', fields: { session_data: 'x' } },
      { model: 'contenttypes.contenttype', pk: 1, fields: { app_label: 'users', model: 'user' } },
      { model: 'destinations.poitag', pk: 1, fields: { name: 'Arte', slug: 'arte' } },
    ];
    expect(() => plan(records)).toThrow(FixtureError);
    expect(() => plan(records)).toThrow('Modelo(s) sem tabela no Nest: contenttypes.contenttype, sessions.session.');
    const skipped = plan(records, true);
    expect(skipped.skippedModels).toEqual({ 'sessions.session': 1, 'contenttypes.contenttype': 1 });
    expect(rowsOf(skipped, 'destinations_poitag')).toEqual([{ id: 1, name: 'Arte', slug: 'arte' }]);
  });

  it('avisa campos com valor que nao tem coluna no Nest (grupos e permissoes do usuario)', () => {
    const user = (pk: number, groups: number[]) => ({
      model: 'users.user',
      pk,
      fields: { password: 'x', username: `u${pk}`, email: `u${pk}@x.com`, groups, user_permissions: [] },
    });
    expect(plan([user(1, [])]).ignoredFields).toEqual({});
    expect(plan([user(1, []), user(2, [3])]).ignoredFields).toEqual({ 'users.user': ['groups'] });
  });

  it('recusa chaves naturais e campo obrigatorio ausente', () => {
    expect(() => plan([{ model: 'destinations.poitag', fields: { name: 'Arte', slug: 'arte' } }])).toThrow(/sem pk .*chaves naturais/);
    expect(() =>
      plan([{ model: 'destinations.destinationcostprofile', pk: 1, fields: { destination: ['rio'], daily_budget_low: '1', daily_budget_mid: '2', daily_budget_high: '3' } }]),
    ).toThrow(/"destination" deve ser um id/);
    expect(() => plan([{ model: 'destinations.pointofinterest', pk: 1, fields: { destination: 1, name: 'X', slug: 'x', poi_type: 'museum', tags: [['arte']] } }])).toThrow(
      /"tags" deve ser uma lista de ids/,
    );
    expect(() => plan([{ model: 'destinations.poitag', pk: 1, fields: { slug: 'arte' } }])).toThrow('destinations.poitag pk=1: campo obrigatorio "name" ausente e sem default');
  });

  it('recusa texto maior que o varchar (dado do SQLite) ou corta com truncateLongText', () => {
    const slug = `${'a'.repeat(49)}çã`;
    const records = [{ model: 'destinations.poitag', pk: 1, fields: { name: 'Arte', slug } }];
    expect(() => plan(records)).toThrow(/destinations\.poitag pk=1 slug: 51 > 50[\s\S]*--truncate/);
    const truncated = planFixture(metadatas, records, { now: NOW, truncateLongText: true });
    expect(rowsOf(truncated, 'destinations_poitag')[0].slug).toBe(`${'a'.repeat(49)}ç`);
    expect(truncated.truncated).toEqual(['destinations.poitag pk=1 slug: 51 > 50']);
  });

  it('planeja o seed inteiro (mesmo arquivo do Django)', () => {
    const result = plan(parseFixture(readFileSync(SEED_FILE, 'utf8'), SEED_FILE));
    const counts = Object.fromEntries(result.tables.map(({ table, rows }) => [table, rows.length]));
    expect(counts).toEqual({
      destinations_destination: 4,
      destinations_destinationcostprofile: 4,
      destinations_poitag: 8,
      destinations_pointofinterest: 16,
    });
    expect(result.junctions[0].pairs.length).toBeGreaterThan(0);
    expect(result.ignoredFields).toEqual({});
  });
});
