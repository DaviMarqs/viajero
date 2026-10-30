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

/** Espera total aceita para repetir chamadas que bateram no rate limit. */
const MAX_RATE_LIMIT_WAIT_MS = 30_000;
const MAX_RATE_LIMIT_ATTEMPTS = 3;

/** Segundos a esperar: header retry-after ou o "try again in 1m2.5s" que o Groq manda no corpo. */
export function rateLimitWaitMs(retryAfter: string | null, body: string): number | null {
  const header = retryAfter?.trim() ? Number(retryAfter) : NaN;
  if (Number.isFinite(header) && header >= 0) return Math.ceil(header * 1000) + 250;
  const match = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(body);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) + 250 : null;
}

/** Em HTTP 429 com espera curta, aguarda e repete (ate 3 tentativas e 30 s); senao devolve a resposta. */
export async function sendWithRateLimitRetry(send: () => Promise<Response>, sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<Response> {
  let waited = 0;
  for (let attempt = 1; ; attempt += 1) {
    const response = await send();
    if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_ATTEMPTS) return response;
    const waitMs = rateLimitWaitMs(response.headers.get('retry-after'), await response.clone().text().catch(() => ''));
    if (waitMs === null || waited + waitMs > MAX_RATE_LIMIT_WAIT_MS) return response;
    await sleep(waitMs);
    waited += waitMs;
  }
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
