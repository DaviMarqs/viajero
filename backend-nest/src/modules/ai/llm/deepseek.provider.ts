import { LlmAuthError, LlmProviderError, LlmQuotaError, LlmResponseError, LlmTimeoutError } from './llm.errors';
import { FetchFn, JsonObject, LlmCallOptions, LlmProvider, parseJsonObject, postJson, readJsonBody, sendWithRateLimitRetry, withJsonInstructions } from './llm-provider';

export interface DeepseekConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  longTimeoutMs: number;
  maxTokens: number;
  thinking: boolean;
}

export class DeepseekProvider implements LlmProvider {
  readonly key = 'deepseek' as const;

  constructor(private readonly config: DeepseekConfig, private readonly fetchFn: FetchFn = fetch) {}

  get model(): string {
    return this.config.model;
  }

  async generateJson(prompt: string, schema: JsonObject, options: LlmCallOptions = {}): Promise<JsonObject> {
    if (!this.config.apiKey) throw new LlmAuthError('DEEPSEEK_API_KEY nao configurada');
    const response = await sendWithRateLimitRetry(() =>
      postJson(this.fetchFn, `${this.config.baseUrl}/chat/completions`, {
        providerName: 'DeepSeek',
        timeoutMs: (options.long ? this.config.longTimeoutMs : this.config.timeoutMs) + (options.extraTimeoutMs ?? 0),
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        body: {
          model: this.config.model,
          messages: [{ role: 'user', content: withJsonInstructions(prompt, schema) }],
          response_format: { type: 'json_object' },
          max_tokens: options.maxOutputTokens ?? this.config.maxTokens,
          thinking: { type: this.config.thinking ? 'enabled' : 'disabled' },
        },
      }),
    );

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      if (response.status === 401 || response.status === 403) throw new LlmAuthError(`DeepSeek auth (HTTP ${response.status}): ${detail}`);
      if (response.status === 402) throw new LlmQuotaError(`DeepSeek sem saldo (HTTP 402): ${detail}`);
      if (response.status === 429) throw new LlmQuotaError(`DeepSeek quota: ${detail}`);
      if (response.status === 408 || response.status === 504) throw new LlmTimeoutError(`DeepSeek timeout (HTTP ${response.status})`);
      throw new LlmProviderError(`DeepSeek erro (HTTP ${response.status}): ${detail}`);
    }

    const payload = await readJsonBody(response, 'DeepSeek');
    const choices = payload.choices as Array<{ message?: { content?: string | null }; finish_reason?: string }> | undefined;
    const text = (choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new LlmResponseError('DeepSeek retornou resposta vazia');
    if (choices?.[0]?.finish_reason === 'length') throw new LlmResponseError('DeepSeek cortou a resposta por limite de tokens');
    return parseJsonObject(text, 'DeepSeek');
  }
}
