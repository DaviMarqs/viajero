import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import {
  applyListQuery,
  buildPage,
  DEFAULT_PAGE_SIZE,
  escapeLike,
  ListQueryOptions,
  MAX_PAGE_SIZE,
  orderByIds,
  parseListQuery,
  parseOrdering,
  parsePage,
  parsePageSize,
  parseSearchTerms,
  runListQuery,
} from '../list-query';

const POI_OPTIONS: ListQueryOptions = {
  searchFields: ['name', 'summary', 'address'],
  orderingFields: ['name', 'rating', 'estimated_visit_minutes'],
  filters: {
    destination: { column: 'destination_id', type: 'int' },
    poi_type: { column: 'poi_type' },
    tags__slug: { condition: ({ column, param }) => `${column('id')} IN (SELECT pointofinterest_id FROM tags WHERE slug = :${param})` },
  },
  defaultOrdering: ['name'],
};

interface FakeQb {
  alias: string;
  calls: Array<[string, ...unknown[]]>;
  rows: unknown[];
  count: number;
}

function fakeQb(rows: unknown[] = [], count = rows.length) {
  const state: FakeQb = { alias: 'poi', calls: [], rows, count };
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      state.calls.push([name, ...args]);
      return qb;
    };
  const qb = {
    alias: 'poi',
    escape: (name: string) => `"${name}"`,
    andWhere: record('andWhere'),
    orderBy: record('orderBy'),
    addOrderBy: record('addOrderBy'),
    limit: record('limit'),
    offset: record('offset'),
    getMany: jest.fn(async () => state.rows),
    getManyAndCount: jest.fn(async () => [state.rows, state.count]),
  };
  return { qb: qb as unknown as SelectQueryBuilder<{ id: number }>, state };
}

describe('parseListQuery', () => {
  it('sem parametros: sem busca, sem filtro, ordenacao padrao e sem paginacao', () => {
    expect(parseListQuery({}, POI_OPTIONS)).toEqual({
      searchTerms: [],
      ordering: [{ field: 'name', direction: 'ASC' }],
      filters: {},
      page: null,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('le busca, ordenacao, filtros permitidos e paginacao', () => {
    const query = parseListQuery(
      { search: 'museu centro', ordering: '-rating,name', destination: '3', poi_type: 'restaurant', tags__slug: 'arte', page: '2', page_size: '5' },
      POI_OPTIONS,
    );
    expect(query).toEqual({
      searchTerms: ['museu', 'centro'],
      ordering: [
        { field: 'rating', direction: 'DESC' },
        { field: 'name', direction: 'ASC' },
      ],
      filters: { destination: 3, poi_type: 'restaurant', tags__slug: 'arte' },
      page: 2,
      pageSize: 5,
    });
  });

  it('ignora campos fora da lista permitida', () => {
    const query = parseListQuery({ user: '1', password: 'x', ordering: 'password,-id', country: 'BR' }, POI_OPTIONS);
    expect(query.filters).toEqual({});
    expect(query.ordering).toEqual([{ field: 'name', direction: 'ASC' }]);
  });

  it('ignora busca quando o recurso nao tem campos de busca', () => {
    expect(parseListQuery({ search: 'x' }, { defaultOrdering: ['-created_at'] }).searchTerms).toEqual([]);
  });

  it('com parametro repetido vale o ultimo valor, como no Django', () => {
    expect(parseListQuery({ poi_type: ['activity', 'lodging'] }, POI_OPTIONS).filters).toEqual({ poi_type: 'lodging' });
  });

  it('filtro vazio e ignorado e filtro inteiro invalido responde 400 com o campo', () => {
    expect(parseListQuery({ destination: '' }, POI_OPTIONS).filters).toEqual({});
    try {
      parseListQuery({ destination: 'abc' }, POI_OPTIONS);
      throw new Error('deveria falhar');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        message: 'Valor invalido para o filtro destination.',
        errors: { destination: ['Informe um numero inteiro valido.'] },
      });
    }
  });
});

describe('partes do parser', () => {
  it('busca separa por espaco e virgula', () => {
    expect(parseSearchTerms(' rio,  praia\tcentro ')).toEqual(['rio', 'praia', 'centro']);
    expect(parseSearchTerms(undefined)).toEqual([]);
  });

  it('ordenacao so com campos invalidos volta ao padrao', () => {
    expect(parseOrdering('-foo,bar', ['name'], ['-created_at'])).toEqual([{ field: 'created_at', direction: 'DESC' }]);
    expect(parseOrdering(' -name , ', ['name'], [])).toEqual([{ field: 'name', direction: 'DESC' }]);
  });

  it('pagina invalida responde 404 e pagina vazia nao pagina', () => {
    expect(parsePage(undefined)).toBeNull();
    expect(parsePage('  ')).toBeNull();
    expect(parsePage('3')).toBe(3);
    for (const value of ['0', '-1', 'abc', '1.5']) {
      expect(() => parsePage(value)).toThrow(NotFoundException);
    }
    expect(() => parsePage('x')).toThrow('Pagina invalida.');
  });

  it('page_size: padrao 12, maximo 100, invalido usa o padrao', () => {
    expect(parsePageSize(undefined)).toBe(12);
    expect(parsePageSize('0')).toBe(12);
    expect(parsePageSize('abc')).toBe(12);
    expect(parsePageSize('30')).toBe(30);
    expect(parsePageSize('1000')).toBe(MAX_PAGE_SIZE);
  });

  it('escapa curingas do LIKE', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('applyListQuery', () => {
  it('busca com ILIKE em todos os campos (OR) e um bloco por termo (AND)', () => {
    const { qb, state } = fakeQb();
    applyListQuery(qb, parseListQuery({ search: 'museu 100%' }, POI_OPTIONS), POI_OPTIONS);
    expect(state.calls.filter(([name]) => name === 'andWhere')).toEqual([
      ['andWhere', '("poi"."name" ILIKE :list_search_0 OR "poi"."summary" ILIKE :list_search_0 OR "poi"."address" ILIKE :list_search_0)', { list_search_0: '%museu%' }],
      ['andWhere', '("poi"."name" ILIKE :list_search_1 OR "poi"."summary" ILIKE :list_search_1 OR "poi"."address" ILIKE :list_search_1)', { list_search_1: '%100\\%%' }],
    ]);
  });

  it('filtra por coluna e por condicao de relacao com parametros nomeados', () => {
    const { qb, state } = fakeQb();
    applyListQuery(qb, parseListQuery({ destination: '7', tags__slug: 'arte' }, POI_OPTIONS), POI_OPTIONS);
    expect(state.calls.filter(([name]) => name === 'andWhere')).toEqual([
      ['andWhere', '"poi"."destination_id" = :list_filter_destination', { list_filter_destination: 7 }],
      ['andWhere', '"poi"."id" IN (SELECT pointofinterest_id FROM tags WHERE slug = :list_filter_tags__slug)', { list_filter_tags__slug: 'arte' }],
    ]);
  });

  it('ordena pelos campos pedidos e desempata pelo id', () => {
    const { qb, state } = fakeQb();
    applyListQuery(qb, parseListQuery({ ordering: '-rating,name' }, POI_OPTIONS), POI_OPTIONS);
    expect(state.calls).toEqual([
      ['orderBy', '"poi"."rating"', 'DESC'],
      ['addOrderBy', '"poi"."name"', 'ASC'],
      ['addOrderBy', '"poi"."id"', 'DESC'],
    ]);
  });
});

describe('runListQuery', () => {
  const url = 'http://api.test/api/pois/?search=museu&page=2&page_size=2';

  it('sem page devolve array com o teto da rota', async () => {
    const { qb, state } = fakeQb([{ id: 1 }, { id: 2 }]);
    const result = await runListQuery({ qb, query: parseListQuery({}, POI_OPTIONS), options: POI_OPTIONS, url, present: (rows) => rows.map((row) => row.id), unpaginatedLimit: 100 });
    expect(result).toEqual([1, 2]);
    expect(state.calls).toContainEqual(['limit', 100]);
    expect(state.calls.some(([name]) => name === 'offset')).toBe(false);
  });

  it('com page devolve count, next, previous e results', async () => {
    const { qb, state } = fakeQb([{ id: 3 }, { id: 4 }], 5);
    const query = parseListQuery({ search: 'museu', page: '2', page_size: '2' }, POI_OPTIONS);
    const result = await runListQuery({ qb, query, options: POI_OPTIONS, url, present: (rows) => rows });
    expect(state.calls).toEqual(expect.arrayContaining([['offset', 2], ['limit', 2]]));
    expect(result).toEqual({
      count: 5,
      next: 'http://api.test/api/pois/?search=museu&page=3&page_size=2',
      previous: 'http://api.test/api/pois/?search=museu&page_size=2',
      results: [{ id: 3 }, { id: 4 }],
    });
  });

  it('pagina alem do fim responde 404; pagina 1 vazia e valida', async () => {
    const empty = fakeQb([], 3);
    const beyond = parseListQuery({ page: '9' }, POI_OPTIONS);
    await expect(runListQuery({ qb: empty.qb, query: beyond, options: POI_OPTIONS, url, present: (rows) => rows })).rejects.toThrow(NotFoundException);

    const first = fakeQb([], 0);
    const result = await runListQuery({ qb: first.qb, query: parseListQuery({ page: '1' }, POI_OPTIONS), options: POI_OPTIONS, url, present: (rows) => rows });
    expect(result).toEqual({ count: 0, next: null, previous: null, results: [] });
  });
});

describe('buildPage e orderByIds', () => {
  it('ultima pagina nao tem next', () => {
    expect(buildPage(['a'], 3, 3, 1, 'http://x/api/a/?page=3')).toEqual({ count: 3, next: null, previous: 'http://x/api/a/?page=2', results: ['a'] });
  });

  it('reordena pela ordem dos ids e descarta os ausentes', () => {
    expect(orderByIds([{ id: '2' }, { id: '1' }], [1, 3, 2])).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
