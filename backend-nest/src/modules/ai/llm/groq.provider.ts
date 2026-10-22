import { LlmAuthError, LlmProviderError, LlmQuotaError, LlmResponseError, LlmTimeoutError } from './llm.errors';
import { FetchFn, JsonObject, LlmCallOptions, LlmProvider, parseJsonObject, postJson, readJsonBody, sendWithRateLimitRetry, withJsonInstructions } from './llm-provider';

export interface GroqConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  longTimeoutMs: number;
  maxTokens: number;
  /** `low` deixa o gpt-oss rapido e evita respostas vazias; vazio nao envia o parametro. */
  reasoningEffort: string;
}

/** Groq pela API compativel com OpenAI. */
export class GroqProvider implements LlmProvider {
  readonly key = 'groq' as const;

  constructor(private readonly config: GroqConfig, private readonly fetchFn: FetchFn = fetch) {}

  get model(): string {
    return this.config.model;
  }

  async generateJson(prompt: string, schema: JsonObject, options: LlmCallOptions = {}): Promise<JsonObject> {
    if (!this.config.apiKey) throw new LlmAuthError('GROQ_API_KEY nao configurada');
    const body: JsonObject = {
      model: this.config.model,
      messages: [{ role: 'user', content: withJsonInstructions(prompt, schema) }],
      response_format: { type: 'json_object' },
      max_completion_tokens: options.maxOutputTokens ?? this.config.maxTokens,
    };
    if (this.config.reasoningEffort) body.reasoning_effort = this.config.reasoningEffort;
    const response = await sendWithRateLimitRetry(() =>
      postJson(this.fetchFn, `${this.config.baseUrl}/chat/completions`, {
        providerName: 'Groq',
        timeoutMs: (options.long ? this.config.longTimeoutMs : this.config.timeoutMs) + (options.extraTimeoutMs ?? 0),
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        body,
      }),
    );

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      // O modo JSON do Groq recusa a geracao quando o modelo sai do JSON: vale nova tentativa.
      if (response.status === 400 && detail.includes('json_validate_failed')) throw new LlmResponseError(`Groq gerou JSON invalido: ${detail}`);
      if (response.status === 401 || response.status === 403) throw new LlmAuthError(`Groq auth (HTTP ${response.status}): ${detail}`);
      if (response.status === 429) throw new LlmQuotaError(`Groq quota: ${detail}`);
      if (response.status === 408 || response.status === 504) throw new LlmTimeoutError(`Groq timeout (HTTP ${response.status})`);
      throw new LlmProviderError(`Groq erro (HTTP ${response.status}): ${detail}`);
    }

    const payload = await readJsonBody(response, 'Groq');
    const choices = payload.choices as Array<{ message?: { content?: string | null } }> | undefined;
    const text = (choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new LlmResponseError('Groq retornou resposta vazia');
    return parseJsonObject(text, 'Groq');
  }
}
