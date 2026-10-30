import { LlmAuthError, LlmProviderError, LlmQuotaError, LlmResponseError, LlmTimeoutError } from './llm.errors';
import { FetchFn, JsonObject, LlmCallOptions, LlmProvider, parseJsonObject, postJson, readJsonBody, sendWithRateLimitRetry, withJsonInstructions } from './llm-provider';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  longTimeoutMs: number;
  maxTokens: number;
}

/** Gemini (Google) pela API REST generateContent. */
export class GeminiProvider implements LlmProvider {
  readonly key = 'gemini' as const;

  constructor(private readonly config: GeminiConfig, private readonly fetchFn: FetchFn = fetch) {}

  get model(): string {
    return this.config.model;
  }

  async generateJson(prompt: string, schema: JsonObject, options: LlmCallOptions = {}): Promise<JsonObject> {
    if (!this.config.apiKey) throw new LlmAuthError('GEMINI_API_KEY nao configurada');
    const response = await sendWithRateLimitRetry(() =>
      postJson(this.fetchFn, `${this.config.baseUrl}/models/${encodeURIComponent(this.config.model)}:generateContent`, {
        providerName: 'Gemini',
        timeoutMs: (options.long ? this.config.longTimeoutMs : this.config.timeoutMs) + (options.extraTimeoutMs ?? 0),
        headers: { 'x-goog-api-key': this.config.apiKey },
        body: {
          contents: [{ role: 'user', parts: [{ text: withJsonInstructions(prompt, schema) }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: options.maxOutputTokens ?? this.config.maxTokens },
        },
      }),
    );

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      if (response.status === 401 || response.status === 403 || detail.includes('API_KEY_INVALID')) {
        throw new LlmAuthError(`Gemini auth (HTTP ${response.status}): ${detail}`);
      }
      if (response.status === 429) throw new LlmQuotaError(`Gemini quota: ${detail}`);
      if (response.status === 408 || response.status === 504) throw new LlmTimeoutError(`Gemini timeout (HTTP ${response.status})`);
      throw new LlmProviderError(`Gemini erro (HTTP ${response.status}): ${detail}`);
    }

    const body = await readJsonBody(response, 'Gemini');
    const candidates = body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const text = (candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim();
    if (!text) throw new LlmResponseError('Gemini retornou resposta vazia');
    return parseJsonObject(text, 'Gemini');
  }
}
