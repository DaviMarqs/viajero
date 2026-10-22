/** Erro generico de qualquer provedor de LLM. */
export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** O provedor nao respondeu dentro do timeout ou a conexao caiu. */
export class LlmTimeoutError extends LlmProviderError {}

/** Credencial invalida ou ausente. */
export class LlmAuthError extends LlmProviderError {}

/** Rate limit ou cota excedida. */
export class LlmQuotaError extends LlmProviderError {}

/** Resposta vazia, JSON invalido ou fora do formato esperado. */
export class LlmResponseError extends LlmProviderError {}
