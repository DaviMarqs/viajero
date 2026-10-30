import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RawListQuery } from './list-query';

export interface ListRequestContext {
  query: RawListQuery;
  /** URL absoluta da requisicao (base de `next`/`previous`, como o `build_absolute_uri` do DRF). */
  url: string;
}

/** Query string crua + URL absoluta para as listas com busca, filtros, ordenacao e paginacao. */
export const ListRequest = createParamDecorator((_data: unknown, context: ExecutionContext): ListRequestContext => {
  const request = context.switchToHttp().getRequest<Request>();
  return {
    query: (request.query ?? {}) as RawListQuery,
    url: `${request.protocol}://${request.get('host') ?? 'localhost'}${request.originalUrl}`,
  };
});
