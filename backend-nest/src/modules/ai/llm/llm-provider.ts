import { LlmProviderError, LlmResponseError, LlmTimeoutError } from './llm.errors';

export type LlmProviderKey = 'groq' | 'gemini';
export type JsonObject = Record<string, unknown>;
export type FetchFn = typeof fetch;

export interface LlmCallOptions {
  /** Geracao de roteiro usa o timeout longo; o resto usa o padrao. */
  long?: boolean;
  /** Limite de tokens da resposta (roteiros longos precisam de mais). */
  maxOutputTokens?: number;
  /** Somado ao timeout (roteiros longos demoram mais para sair). */
  extraTimeoutMs?: number;
}

/** Maior espera aceita para repetir uma chamada que bateu no rate limit (header retry-after). */
const MAX_RATE_LIMIT_WAIT_MS = 30_000;

/** Em HTTP 429 com retry-after curto, espera e repete uma vez; senao devolve a resposta original. */
export async function sendWithRateLimitRetry(send: () => Promise<Response>): Promise<Response> {
  const response = await send();
  if (response.status !== 429) return response;
  const header = response.headers.get('retry-after');
  const seconds = header === null || header.trim() === '' ? NaN : Number(header);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds * 1000 > MAX_RATE_LIMIT_WAIT_MS) return response;
  await new Promise((resolve) => setTimeout(resolve, Math.ceil(seconds * 1000) + 250));
  return send();
}

/** Contrato de um provedor de LLM: so envia o prompt e devolve o JSON parseado. */
export interface LlmProvider {
  readonly key: LlmProviderKey;
  readonly model: string;
  generateJson(prompt: string, schema: JsonObject, options?: LlmCallOptions): Promise<JsonObject>;
}

const MARKDOWN_FENCE = /^```(?:json)?\s*|\s*```$/gm;

export function withJsonInstructions(prompt: string, schema: JsonObject): string {
  return (
    `${prompt}\n\n` +
    'Responda APENAS com JSON valido aderente ao schema abaixo, sem cercas de markdown e sem texto adicional:\n' +
    JSON.stringify(schema)
  );
}

export function parseJsonObject(text: string, providerName: string): JsonObject {
  const cleaned = text.replace(MARKDOWN_FENCE, '').trim();
  let payload: unknown;
  try {
    payload = JSON.parse(cleaned);
  } catch (error) {
    throw new LlmResponseError(`${providerName} retornou JSON invalido: ${(error as Error).message}`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new LlmResponseError(`${providerName} retornou JSON que nao e um objeto`);
  }
  return payload as JsonObject;
}

/** Faz o POST e converte falhas de rede/timeout em erros de LLM. */
export async function postJson(fetchFn: FetchFn, url: string, init: { headers: Record<string, string>; body: unknown; timeoutMs: number; providerName: string }): Promise<Response> {
  try {
    return await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new LlmTimeoutError(`${init.providerName} timeout apos ${init.timeoutMs} ms`);
    }
    throw new LlmTimeoutError(`${init.providerName} conexao: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readJsonBody(response: Response, providerName: string): Promise<JsonObject> {
  try {
    const body = (await response.json()) as unknown;
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as JsonObject;
  } catch {
    // cai no erro abaixo
  }
  throw new LlmProviderError(`${providerName} devolveu corpo nao-JSON (HTTP ${response.status})`);
}
