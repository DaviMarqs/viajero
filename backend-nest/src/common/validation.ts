import { Transform } from 'class-transformer';

/** Para DTOs de PATCH: valida o campo so quando ele foi enviado (null continua invalido). */
export const isDefined = (_object: object, value: unknown): boolean => value !== undefined;

/**
 * Ids bigint saem da API como string (padrao do TypeORM); o front pode devolve-los assim.
 * Converte "12" em 12 antes do @IsInt. Valores nao numericos seguem como estao e falham na validacao.
 */
export const ToId = () =>
  Transform(({ value }) => (typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value));
