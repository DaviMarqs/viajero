/** Para DTOs de PATCH: valida o campo so quando ele foi enviado (null continua invalido). */
export const isDefined = (_object: object, value: unknown): boolean => value !== undefined;
