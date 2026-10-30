import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** Mesmo PAGE_SIZE do DRF (`backend/config/settings/base.py`). */
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;
export const INVALID_PAGE_MESSAGE = 'Pagina invalida.';

export type RawListQuery = Record<string, unknown>;

/**
 * Filtro exato de um campo da lista permitida.
 * `column`: coluna da tabela raiz (ex.: `destination_id`).
 * `condition`: SQL proprio, para filtros em relacao (ex.: `tags__slug`); use `:${param}` como valor.
 */
export interface ListFilter {
  column?: string;
  condition?: (context: { column: (name: string) => string; param: string }) => string;
  type?: 'string' | 'int';
}

/** Campos em nomes de coluna do banco, como `filterset_fields`, `search_fields` e `ordering_fields` do Django. */
export interface ListQueryOptions {
  searchFields?: readonly string[];
  orderingFields?: readonly string[];
  filters?: Readonly<Record<string, ListFilter>>;
  /** Ordenacao quando `ordering` nao vem ou so traz campos fora da lista (ex.: `['-created_at']`). */
  defaultOrdering: readonly string[];
}

export interface OrderTerm {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface ListQuery {
  searchTerms: string[];
  ordering: OrderTerm[];
  filters: Record<string, string | number>;
  /** `null` = sem paginacao: a lista volta como array (contrato atual do front). */
  page: number | null;
  pageSize: number;
}

export interface PaginatedList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Como o `QueryDict.get` do Django: com o parametro repetido vale o ultimo. */
function lastString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.length ? lastString(value[value.length - 1]) : undefined;
  return typeof value === 'string' ? value : undefined;
}

/** Igual ao SearchFilter do DRF: virgula e espaco separam termos; todos os termos precisam casar. */
export function parseSearchTerms(value: string | undefined): string[] {
  if (!value) return [];
  return value.replace(/\0/g, '').replace(/,/g, ' ').split(/\s+/).filter(Boolean);
}

function toOrderTerm(raw: string): OrderTerm {
  return raw.startsWith('-') ? { field: raw.slice(1), direction: 'DESC' } : { field: raw, direction: 'ASC' };
}

/** Campos fora da lista sao ignorados; se nenhum sobrar, vale a ordenacao padrao (OrderingFilter do DRF). */
export function parseOrdering(value: string | undefined, allowed: readonly string[], fallback: readonly string[]): OrderTerm[] {
  const requested = (value ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .map(toOrderTerm)
    .filter((term) => allowed.includes(term.field));
  return requested.length ? requested : fallback.map(toOrderTerm);
}

/** Sem `page` (ou vazio) nao pagina. Numero invalido responde 404, como o PageNumberPagination do DRF. */
export function parsePage(value: string | undefined): number | null {
  if (value === undefined || !value.trim()) return null;
  const page = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(page) || page < 1) throw new NotFoundException(INVALID_PAGE_MESSAGE);
  return page;
}

/** Valor invalido usa o padrao; acima do maximo fica no maximo. */
export function parsePageSize(value: string | undefined): number {
  const size = value && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(size, MAX_PAGE_SIZE);
}

export function parseFilters(raw: RawListQuery, filters: Readonly<Record<string, ListFilter>> = {}): Record<string, string | number> {
  const parsed: Record<string, string | number> = {};
  for (const [name, filter] of Object.entries(filters)) {
    const value = lastString(raw[name])?.trim();
    if (value === undefined || value === '') continue;
    if (filter.type === 'int') {
      if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new BadRequestException({
          message: `Valor invalido para o filtro ${name}.`,
          errors: { [name]: ['Informe um numero inteiro valido.'] },
        });
      }
      parsed[name] = Number(value);
    } else {
      parsed[name] = value;
    }
  }
  return parsed;
}

export function parseListQuery(raw: RawListQuery, options: ListQueryOptions): ListQuery {
  return {
    searchTerms: options.searchFields?.length ? parseSearchTerms(lastString(raw.search)) : [],
    ordering: parseOrdering(lastString(raw.ordering), options.orderingFields ?? [], options.defaultOrdering),
    filters: parseFilters(raw, options.filters),
    page: parsePage(lastString(raw.page)),
    pageSize: parsePageSize(lastString(raw.page_size)),
  };
}

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Aplica busca (ILIKE), filtros e ordenacao na raiz do query builder. Paginacao fica com `runListQuery`. */
export function applyListQuery<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, query: ListQuery, options: ListQueryOptions): SelectQueryBuilder<T> {
  const alias = qb.alias;
  const column = (name: string) => `${qb.escape(alias)}.${qb.escape(name)}`;

  const searchFields = options.searchFields ?? [];
  query.searchTerms.forEach((term, index) => {
    if (!searchFields.length) return;
    const param = `list_search_${index}`;
    qb.andWhere(`(${searchFields.map((field) => `${column(field)} ILIKE :${param}`).join(' OR ')})`, { [param]: `%${escapeLike(term)}%` });
  });

  Object.entries(query.filters).forEach(([name, value]) => {
    const filter = options.filters?.[name];
    if (!filter) return;
    const param = `list_filter_${name.replace(/\W/g, '_')}`;
    const condition = filter.condition ? filter.condition({ column, param }) : `${column(filter.column ?? name)} = :${param}`;
    qb.andWhere(condition, { [param]: value });
  });

  query.ordering.forEach((term, index) => {
    if (index === 0) qb.orderBy(column(term.field), term.direction);
    else qb.addOrderBy(column(term.field), term.direction);
  });
  // Desempate estavel para a paginacao nao repetir nem pular registros.
  const tieBreak = query.ordering[0]?.direction ?? 'ASC';
  if (query.ordering.length) qb.addOrderBy(column('id'), tieBreak);
  else qb.orderBy(column('id'), tieBreak);
  return qb;
}

function withPage(url: string, page: number): string {
  const target = new URL(url);
  if (page <= 1) target.searchParams.delete('page');
  else target.searchParams.set('page', String(page));
  return target.toString();
}

/** `next`/`previous` como no DRF: URL absoluta com a query; a pagina 1 sai sem `page`. */
export function buildPage<T>(results: T[], count: number, page: number, pageSize: number, url: string): PaginatedList<T> {
  return {
    count,
    next: page * pageSize < count ? withPage(url, page + 1) : null,
    previous: page > 1 ? withPage(url, page - 1) : null,
    results,
  };
}

/** Recoloca as linhas carregadas com relacoes na ordem dos ids da consulta paginada. */
export function orderByIds<T extends { id: number | string }>(rows: T[], ids: Array<number | string>): T[] {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  return ids.map((id) => byId.get(String(id))).filter((row): row is T => row !== undefined);
}

export interface RunListQueryInput<T extends ObjectLiteral, R> {
  qb: SelectQueryBuilder<T>;
  query: ListQuery;
  options: ListQueryOptions;
  /** URL absoluta da requisicao, para montar `next` e `previous`. */
  url: string;
  /** Converte as linhas (ex.: carrega relacoes ou aplica presenter) mantendo a ordem. */
  present: (rows: T[]) => Promise<R[]> | R[];
  /** Teto da lista sem paginacao, para manter o comportamento das rotas atuais. */
  unpaginatedLimit?: number;
}

/** Sem `page` devolve array (contrato atual); com `page` devolve `{ count, next, previous, results }`. */
export async function runListQuery<T extends ObjectLiteral, R>(input: RunListQueryInput<T, R>): Promise<R[] | PaginatedList<R>> {
  const { qb, query, options } = input;
  applyListQuery(qb, query, options);
  if (query.page === null) {
    if (input.unpaginatedLimit) qb.limit(input.unpaginatedLimit);
    return input.present(await qb.getMany());
  }
  qb.offset((query.page - 1) * query.pageSize).limit(query.pageSize);
  const [rows, count] = await qb.getManyAndCount();
  if (query.page > 1 && rows.length === 0) throw new NotFoundException(INVALID_PAGE_MESSAGE);
  return buildPage(await input.present(rows), count, query.page, query.pageSize, input.url);
}
