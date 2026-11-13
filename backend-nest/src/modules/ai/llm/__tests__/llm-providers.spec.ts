import { Logger } from '@nestjs/common';
import { GroqProvider } from '../groq.provider';
import { GeminiProvider } from '../gemini.provider';
import { DeepseekProvider } from '../deepseek.provider';
import { LlmService } from '../llm.service';
import { ConfigService } from '@nestjs/config';
import { LlmAuthError, LlmQuotaError, LlmResponseError, LlmTimeoutError } from '../llm.errors';
import { LlmProvider, rateLimitWaitMs, sendWithRateLimitRetry } from '../llm-provider';
import { requestLlmJson } from '../llm.service';

const config = { apiKey: 'key', model: 'model-x', baseUrl: 'https://llm.test', timeoutMs: 1000, longTimeoutMs: 2000, maxTokens: 4096, reasoningEffort: 'low' };
const reply = (status: number, body: unknown) => jest.fn().mockResolvedValue(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe('GroqProvider', () => {
  it('envia o prompt com instrucao de JSON e parseia a resposta sem cercas de markdown', async () => {
    const fetchFn = reply(200, { choices: [{ message: { content: '```json\n{"ok": true}\n```' } }] });
    const payload = await new GroqProvider(config, fetchFn).generateJson('Prompt', { type: 'object' });
    expect(payload).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://llm.test/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('model-x');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_completion_tokens).toBe(4096);
    expect(body.reasoning_effort).toBe('low');
    expect(body.messages[0].content).toContain('Responda APENAS com JSON valido');
    expect(init.headers.Authorization).toBe('Bearer key');
  });

  it('traduz status HTTP em erros de dominio', async () => {
    await expect(new GroqProvider(config, reply(429, 'slow down')).generateJson('p', {})).rejects.toBeInstanceOf(LlmQuotaError);
    await expect(new GroqProvider(config, reply(401, 'bad key')).generateJson('p', {})).rejects.toBeInstanceOf(LlmAuthError);
    await expect(new GroqProvider(config, reply(200, { choices: [{ message: { content: 'nao e json' } }] })).generateJson('p', {})).rejects.toBeInstanceOf(LlmResponseError);
    await expect(new GroqProvider(config, reply(200, { choices: [{ message: { content: '[1, 2]' } }] })).generateJson('p', {})).rejects.toBeInstanceOf(LlmResponseError);
    await expect(new GroqProvider(config, reply(400, '{"error":{"code":"json_validate_failed"}}')).generateJson('p', {})).rejects.toBeInstanceOf(LlmResponseError);
  });

  it('respeita retry-after curto em 429 e repete uma vez', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(new Response('limit', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] }), { status: 200 }));
    await expect(new GroqProvider(config, fetchFn).generateJson('p', {}, { maxOutputTokens: 100 })).resolves.toEqual({ ok: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchFn.mock.calls[1][1].body).max_completion_tokens).toBe(100);
  });

  it('timeout de rede vira LlmTimeoutError', async () => {
    const fetchFn = jest.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    await expect(new GroqProvider(config, fetchFn).generateJson('p', {})).rejects.toBeInstanceOf(LlmTimeoutError);
  });

  it('sem chave falha antes de chamar a API', async () => {
    const fetchFn = jest.fn();
    await expect(new GroqProvider({ ...config, apiKey: '' }, fetchFn).generateJson('p', {})).rejects.toBeInstanceOf(LlmAuthError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('rate limit', () => {
  it('le o retry-after ou o "try again in" do corpo do Groq', () => {
    expect(rateLimitWaitMs('2', '')).toBe(2250);
    expect(rateLimitWaitMs(null, 'Please try again in 3.24s. Need more tokens?')).toBe(3490);
    expect(rateLimitWaitMs(null, 'Please try again in 1m2.5s')).toBe(62750);
    expect(rateLimitWaitMs(null, 'limit')).toBeNull();
  });

  it('repete ate 3 vezes sem passar de 30 s de espera', async () => {
    const limited = () => new Response('Please try again in 4s', { status: 429 });
    const sleep = jest.fn().mockResolvedValue(undefined);
    const send = jest.fn().mockImplementation(() => Promise.resolve(limited()));
    const response = await sendWithRateLimitRetry(send, sleep);
    expect(response.status).toBe(429);
    expect(send).toHaveBeenCalledTimes(3);
    expect(await response.text()).toContain('try again');
    const slow = jest.fn().mockImplementation(() => Promise.resolve(new Response('Please try again in 1m', { status: 429 })));
    await sendWithRateLimitRetry(slow, sleep);
    expect(slow).toHaveBeenCalledTimes(1);
  });
});

describe('GeminiProvider', () => {
  it('junta as partes do candidato e pede JSON', async () => {
    const fetchFn = reply(200, { candidates: [{ content: { parts: [{ text: '{"a":' }, { text: ' 1}' }] } }] });
    await expect(new GeminiProvider(config, fetchFn).generateJson('p', {}, { long: true })).resolves.toEqual({ a: 1 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://llm.test/models/model-x:generateContent');
    expect(JSON.parse(init.body).generationConfig).toEqual({ responseMimeType: 'application/json', maxOutputTokens: 4096 });
    expect(init.headers['x-goog-api-key']).toBe('key');
  });

  it('chave invalida (HTTP 400 API_KEY_INVALID) vira LlmAuthError', async () => {
    await expect(new GeminiProvider(config, reply(400, '{"error":{"status":"API_KEY_INVALID"}}')).generateJson('p', {})).rejects.toBeInstanceOf(LlmAuthError);
  });
});

describe('requestLlmJson', () => {
  const logger = { warn: jest.fn() } as unknown as Logger;
  const provider = (key: 'groq' | 'gemini', ...results: Array<unknown>): LlmProvider & { generateJson: jest.Mock } => {
    const generateJson = jest.fn();
    results.forEach((result) => (result instanceof Error ? generateJson.mockRejectedValueOnce(result) : generateJson.mockResolvedValueOnce(result)));
    return { key, model: `${key}-model`, generateJson };
  };

  it('repete com prompt reforcado (com o motivo) quando a resposta e invalida', async () => {
    const groq = provider('groq', new LlmResponseError('json ruim'), { ok: 1 });
    const finals: boolean[] = [];
    const result = await requestLlmJson([groq], { label: 't', prompt: 'P', schema: {}, parse: (payload, attempt) => (finals.push(attempt.final), payload.ok) }, logger);
    expect(result.value).toBe(1);
    expect(groq.generateJson.mock.calls[1][0]).toContain('Sua resposta anterior foi rejeitada: json ruim.');
    expect(finals).toEqual([true]);
  });

  it('erro de validacao no parse tambem conta como resposta invalida', async () => {
    const groq = provider('groq', { days: [] }, { days: [1] });
    const parse = (payload: Record<string, unknown>) => {
      if (!(payload.days as unknown[]).length) throw new Error('sem dias');
      return payload.days;
    };
    await expect(requestLlmJson([groq], { label: 't', prompt: 'P', schema: {}, parse }, logger)).resolves.toMatchObject({ value: [1] });
  });

  it('cota estourada passa direto para o proximo provedor', async () => {
    const groq = provider('groq', new LlmQuotaError('429'));
    const gemini = provider('gemini', { ok: 2 });
    const result = await requestLlmJson([groq, gemini], { label: 't', prompt: 'P', schema: {}, parse: (payload) => payload.ok }, logger);
    expect(groq.generateJson).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ value: 2, provider: { key: 'gemini' } });
  });

  it('propaga o ultimo erro quando todos falham, e erra sem provedores', async () => {
    const groq = provider('groq', new LlmTimeoutError('lento'));
    await expect(requestLlmJson([groq], { label: 't', prompt: 'P', schema: {}, parse: (p) => p }, logger)).rejects.toBeInstanceOf(LlmTimeoutError);
    await expect(requestLlmJson([], { label: 't', prompt: 'P', schema: {}, parse: (p) => p }, logger)).rejects.toThrow('Nenhum provedor de IA configurado.');
  });
});

describe('DeepseekProvider', () => {
  const dsConfig = { apiKey: 'key', model: 'deepseek-flash', baseUrl: 'https://ds.test', timeoutMs: 1000, longTimeoutMs: 2000, maxTokens: 4096, thinking: false };

  it('envia max_tokens, desliga o pensamento e parseia o JSON', async () => {
    const fetchFn = reply(200, { choices: [{ message: { content: '{"ok": true}' }, finish_reason: 'stop' }] });
    await expect(new DeepseekProvider(dsConfig, fetchFn).generateJson('Prompt', { type: 'object' }, { maxOutputTokens: 100 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://ds.test/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-flash');
    expect(body.max_tokens).toBe(100);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toContain('JSON');
    expect(init.headers.Authorization).toBe('Bearer key');
  });

  it('liga o pensamento quando configurado', async () => {
    const fetchFn = reply(200, { choices: [{ message: { content: '{}' } }] });
    await new DeepseekProvider({ ...dsConfig, thinking: true }, fetchFn).generateJson('p', {});
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).thinking).toEqual({ type: 'enabled' });
  });

  it('traduz erros: 402 (sem saldo) e 429 viram cota, 401 credencial, vazio/cortado resposta invalida', async () => {
    await expect(new DeepseekProvider(dsConfig, reply(402, 'Insufficient Balance')).generateJson('p', {})).rejects.toBeInstanceOf(LlmQuotaError);
    await expect(new DeepseekProvider(dsConfig, reply(429, 'busy')).generateJson('p', {})).rejects.toBeInstanceOf(LlmQuotaError);
    await expect(new DeepseekProvider(dsConfig, reply(401, 'bad key')).generateJson('p', {})).rejects.toBeInstanceOf(LlmAuthError);
    await expect(new DeepseekProvider(dsConfig, reply(200, { choices: [{ message: { content: '   ' } }] })).generateJson('p', {})).rejects.toBeInstanceOf(LlmResponseError);
    await expect(new DeepseekProvider(dsConfig, reply(200, { choices: [{ message: { content: '{"a":' }, finish_reason: 'length' }] })).generateJson('p', {})).rejects.toBeInstanceOf(LlmResponseError);
  });

  it('sem chave falha antes de chamar a API', async () => {
    const fetchFn = jest.fn();
    await expect(new DeepseekProvider({ ...dsConfig, apiKey: '' }, fetchFn).generateJson('p', {})).rejects.toBeInstanceOf(LlmAuthError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('LlmService com DeepSeek', () => {
  const service = (env: Record<string, string>) => new LlmService(new ConfigService(env));
  const keys = (providers: LlmProvider[]) => providers.map((p) => p.key);

  it('so com chave do DeepSeek e DEFAULT_LLM_PROVIDER=deepseek, a cadeia do roteiro e o DeepSeek', () => {
    const llm = service({ DEFAULT_LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'k' });
    expect(llm.hasAny()).toBe(true);
    expect(keys(llm.itineraryChain())).toEqual(['deepseek']);
    expect(llm.itineraryChain()[0].model).toBe('deepseek-flash');
  });

  it('deepseek principal vai na frente; nos outros casos entra como reserva no fim', () => {
    const all = { DEEPSEEK_API_KEY: 'd', GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm' };
    expect(keys(service({ ...all, DEFAULT_LLM_PROVIDER: 'deepseek' }).itineraryChain())).toEqual(['deepseek', 'groq', 'gemini']);
    expect(keys(service({ ...all, DEFAULT_LLM_PROVIDER: 'groq' }).itineraryChain())).toEqual(['groq', 'gemini', 'deepseek']);
    expect(keys(service({ ...all, DEFAULT_LLM_PROVIDER: 'groq' }).chain(['gemini', 'groq']))).toEqual(['gemini', 'groq', 'deepseek']);
  });

  it('mock ignora o DeepSeek no roteiro', () => {
    expect(service({ DEFAULT_LLM_PROVIDER: 'mock', DEEPSEEK_API_KEY: 'k' }).itineraryChain()).toEqual([]);
  });
});
