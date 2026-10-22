import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { JsonObject, LlmProvider, LlmProviderKey } from './llm-provider';
import { LlmProviderError, LlmResponseError } from './llm.errors';

export interface LlmJsonRequest<T> {
  /** Usado nos logs ("roteiro", "resolver de destino"...). */
  label: string;
  prompt: string;
  schema: JsonObject;
  long?: boolean;
  maxOutputTokens?: number;
  extraTimeoutMs?: number;
  /**
   * Valida/normaliza o JSON; erros aqui contam como resposta invalida e disparam nova tentativa.
   * `final` e true na ultima tentativa de cada provedor, para o parse poder ser mais tolerante.
   */
  parse: (payload: JsonObject, attempt: { final: boolean }) => T;
}

export interface LlmJsonResult<T> {
  value: T;
  provider: LlmProvider;
}

export function reinforcePrompt(prompt: string, reason?: string): string {
  const problem = reason ? `Sua resposta anterior foi rejeitada: ${reason}.` : 'Sua resposta anterior nao era JSON valido.';
  return `${prompt}\n\nIMPORTANTE: ${problem} Corrija e responda APENAS com JSON, sem texto antes ou depois.`;
}

/**
 * Tenta cada provedor na ordem. Resposta invalida ganha uma segunda tentativa com o prompt reforcado
 * (igual ao Django); timeout, cota ou credencial passam direto para o proximo provedor.
 */
export async function requestLlmJson<T>(providers: LlmProvider[], request: LlmJsonRequest<T>, logger?: Logger): Promise<LlmJsonResult<T>> {
  let lastError: Error = new LlmProviderError('Nenhum provedor de IA configurado.');
  for (const provider of providers) {
    let prompt = request.prompt;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const payload = await provider.generateJson(prompt, request.schema, {
          long: request.long,
          maxOutputTokens: request.maxOutputTokens,
          extraTimeoutMs: request.extraTimeoutMs,
        });
        try {
          return { value: request.parse(payload, { final: attempt === 2 }), provider };
        } catch (error) {
          throw error instanceof LlmProviderError ? error : new LlmResponseError(error instanceof Error ? error.message : String(error));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new LlmProviderError(String(error));
        logger?.warn(`${request.label}: ${provider.key} tentativa ${attempt} falhou (${lastError.name}): ${lastError.message}`);
        if (lastError instanceof LlmResponseError && attempt === 1) {
          prompt = reinforcePrompt(request.prompt, lastError.message);
          continue;
        }
        break;
      }
    }
  }
  throw lastError;
}

const seconds = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return (Number.isFinite(parsed) && parsed > 0 ? parsed : fallback) * 1000;
};

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/** gpt-oss raciocina antes de responder; `low` deixa rapido. Outros modelos so recebem o parametro se configurado. */
function groqReasoningEffort(configured: string | undefined, model: string): string {
  const value = (configured ?? '').trim().toLowerCase();
  if (value === 'off') return '';
  return value || (model.includes('gpt-oss') ? 'low' : '');
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providers = new Map<LlmProviderKey, LlmProvider>();
  private readonly defaultProvider: string;

  constructor(config: ConfigService) {
    this.defaultProvider = (config.get<string>('DEFAULT_LLM_PROVIDER') || 'mock').trim().toLowerCase();
    const groqKey = config.get<string>('GROQ_API_KEY', '').trim();
    const groqModel = config.get<string>('GROQ_MODEL') || 'openai/gpt-oss-120b';
    if (groqKey) {
      this.providers.set(
        'groq',
        new GroqProvider({
          apiKey: groqKey,
          model: groqModel,
          baseUrl: (config.get<string>('GROQ_API_URL') || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
          timeoutMs: seconds(config.get<string>('GROQ_TIMEOUT'), 20),
          longTimeoutMs: seconds(config.get<string>('GROQ_ITINERARY_TIMEOUT'), 40),
          maxTokens: positiveInt(config.get<string>('GROQ_MAX_TOKENS'), 8192),
          reasoningEffort: groqReasoningEffort(config.get<string>('GROQ_REASONING_EFFORT'), groqModel),
        }),
      );
    }
    const geminiKey = config.get<string>('GEMINI_API_KEY', '').trim();
    if (geminiKey) {
      this.providers.set(
        'gemini',
        new GeminiProvider({
          apiKey: geminiKey,
          model: config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash-lite',
          baseUrl: (config.get<string>('GEMINI_API_URL') || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, ''),
          timeoutMs: seconds(config.get<string>('GEMINI_TIMEOUT'), 20),
          longTimeoutMs: seconds(config.get<string>('GEMINI_ITINERARY_TIMEOUT'), 40),
          maxTokens: positiveInt(config.get<string>('GEMINI_MAX_TOKENS'), 8192),
        }),
      );
    }
  }

  hasAny(): boolean {
    return this.providers.size > 0;
  }

  /** Provedores configurados (com chave), na ordem pedida. */
  chain(order: LlmProviderKey[]): LlmProvider[] {
    return order.map((key) => this.providers.get(key)).filter((provider): provider is LlmProvider => provider !== undefined);
  }

  /**
   * Provedores para gerar roteiro, conforme DEFAULT_LLM_PROVIDER (paridade com o Django):
   * `mock` -> nenhum (gerador deterministico); `gemini`/`groq` -> o escolhido e o outro como reserva.
   * Sem nenhuma chave, a lista sai vazia e o roteiro cai no mock.
   */
  itineraryChain(): LlmProvider[] {
    if (this.defaultProvider === 'mock') return [];
    return this.chain(this.defaultProvider === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini']);
  }

  requestJson<T>(providers: LlmProvider[], request: LlmJsonRequest<T>): Promise<LlmJsonResult<T>> {
    return requestLlmJson(providers, request, this.logger);
  }
}
