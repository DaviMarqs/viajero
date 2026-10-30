import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtlCache } from './ttl-cache';

export class FirecrawlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirecrawlError';
  }
}

export interface ExtractedPoi {
  name?: unknown;
  type?: unknown;
  tags?: unknown;
  summary?: unknown;
  image_url?: unknown;
  source?: string;
  source_url?: string;
}

export interface ExtractedCosts {
  low?: unknown;
  mid?: unknown;
  high?: unknown;
}

/** Dados agregados do scrape de uma ou mais URLs, sem tocar no banco. */
export interface AggregatedExtraction {
  sourceUrls: string[];
  meta: Record<string, unknown>;
  pois: ExtractedPoi[];
  costs: ExtractedCosts | null;
  failures: Array<{ url: string; error: string }>;
}

/** Dominios que o Firecrawl recusa ou que trazem pouco conteudo util (redes sociais, booking com anti-bot). */
const UNSUPPORTED_SEARCH_HOSTS = [
  'instagram.com', 'facebook.com', 'fb.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'x.com', 'twitter.com',
  'linkedin.com', 'reddit.com', 'pinterest.com', 'threads.net', 'expedia.com', 'expedia.es', 'booking.com',
  'hotels.com', 'trivago.com', 'kayak.com', 'decolar.com', 'hoteis.com', 'hotelroyalpark.com.br', 'hurb.com',
  'airbnb.com', 'tripadvisor.com', 'tripadvisor.com.br',
];

const EXTRACTION_PROMPT =
  'Voce esta extraindo dados de um guia turistico para alimentar um app de viagem. ' +
  'Resuma o destino em 2 a 3 paragrafos em portugues do Brasil, focando no que o torna especial. ' +
  'Custos sao diarias estimadas em BRL (low/mid/high) para um viajante. ' +
  'Liste ate 10 POIs entre atracoes, restaurantes notaveis, atividades e bairros/hoteis para hospedar-se. ' +
  "Use exatamente um destes valores no campo 'type': attraction, restaurant, activity, lodging. " +
  "Para 'hero_image_url' devolva a URL absoluta de uma imagem representativa do destino (banner/og:image). " +
  "Cada POI pode incluir 'image_url' com uma foto representativa.";

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    country: { type: 'string' },
    city: { type: 'string' },
    summary: { type: 'string' },
    hero_image_url: { type: 'string', description: 'URL absoluta de uma imagem hero/banner representativa do destino' },
    best_season: { type: 'string' },
    timezone: { type: 'string' },
    costs: { type: 'object', properties: { low: { type: 'number' }, mid: { type: 'number' }, high: { type: 'number' } } },
    pois: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          image_url: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
};

const META_KEYS = ['name', 'country', 'city', 'best_season', 'timezone', 'summary', 'hero_image_url'];
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 300_000;
const CIRCUIT_OPEN_MS = 300_000;
/** Sem pelo menos esse tempo de prazo, nao vale comecar outro scrape. */
const MIN_SCRAPE_WINDOW_MS = 5_000;

export function isSupportedUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  return !UNSUPPORTED_SEARCH_HOSTS.some((host) => lowered.includes(`//${host}/`) || lowered.includes(`//www.${host}/`));
}

/** Pagina da Wikipedia para o scrape de reserva; com regiao usa o titulo desambiguado ("Formiga (Minas Gerais)"). */
export function wikipediaFallbackUrl(query: string, region = ''): string {
  const title = region.trim() ? `${query.trim()} (${region.trim()})` : query.trim();
  return `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

const numberSetting = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Cliente do Firecrawl (search + scrape com extracao JSON), com circuit breaker e cache negativo em memoria. */
@Injectable()
export class FirecrawlClient {
  private readonly logger = new Logger(FirecrawlClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly searchLimit: number;
  private readonly searchTimeoutMs: number;
  private readonly scrapeTimeoutMs: number;
  private readonly failureTtlMs: number;
  private readonly discoveryBudgetMs: number;
  private readonly cache = new TtlCache<number | boolean>();
  private fetchFn: typeof fetch = fetch;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('FIRECRAWL_API_KEY', '').trim();
    this.baseUrl = (config.get<string>('FIRECRAWL_API_URL') || 'https://api.firecrawl.dev/v1').trim().replace(/\/+$/, '');
    this.searchLimit = numberSetting(config.get<string>('FIRECRAWL_SEARCH_LIMIT'), 2);
    this.searchTimeoutMs = numberSetting(config.get<string>('FIRECRAWL_SEARCH_TIMEOUT'), 15) * 1000;
    this.scrapeTimeoutMs = numberSetting(config.get<string>('FIRECRAWL_SCRAPE_TIMEOUT'), 25) * 1000;
    this.failureTtlMs = numberSetting(config.get<string>('FIRECRAWL_DISCOVERY_FAILURE_TTL'), 60) * 1000;
    this.discoveryBudgetMs = numberSetting(config.get<string>('FIRECRAWL_DISCOVERY_BUDGET'), 45) * 1000;
  }

  /** Para testes. */
  useFetch(fetchFn: typeof fetch): this {
    this.fetchFn = fetchFn;
    return this;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async request(path: string, body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new FirecrawlError(`Falha de rede ao contatar o Firecrawl (${path}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (response.status === 401) throw new FirecrawlError(`Credencial Firecrawl invalida (HTTP 401) em ${path}`);
    if (response.status === 429) throw new FirecrawlError(`Limite de requisicoes do Firecrawl atingido (HTTP 429) em ${path}`);
    if (response.status >= 400) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new FirecrawlError(`Firecrawl ${response.status >= 500 ? 'indisponivel' : 'rejeitou requisicao'} (HTTP ${response.status}) em ${path}: ${detail}`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new FirecrawlError(`Firecrawl devolveu resposta nao-JSON em ${path}`);
    }
    const result = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
    if (result.success === false) throw new FirecrawlError(`Firecrawl reportou falha em ${path}: ${String(result.error ?? 'sem detalhe')}`);
    return result;
  }

  async searchUrls(query: string, country = '', timeoutMs = this.searchTimeoutMs): Promise<string[]> {
    const body = await this.request('/search', { query: [query, 'turismo', country || 'Brasil'].join(' '), limit: this.searchLimit }, timeoutMs);
    const items = Array.isArray(body.data) ? body.data : [];
    return items
      .map((item) => (item && typeof item === 'object' ? (item as { url?: unknown }).url : undefined))
      .filter((url): url is string => typeof url === 'string' && url.length > 0 && isSupportedUrl(url));
  }

  async scrape(url: string, timeoutMs = this.scrapeTimeoutMs): Promise<Record<string, unknown>> {
    const body = await this.request(
      '/scrape',
      { url, formats: ['json'], jsonOptions: { schema: EXTRACTION_SCHEMA, prompt: EXTRACTION_PROMPT } },
      timeoutMs,
    );
    const data = (body.data ?? {}) as Record<string, unknown>;
    const extracted = data.json ?? data.extract;
    return extracted && typeof extracted === 'object' && !Array.isArray(extracted) ? (extracted as Record<string, unknown>) : {};
  }

  /**
   * Faz o scrape de cada URL, tolerando falhas individuais e parando assim que tiver resumo + POIs
   * ou quando o prazo (`deadline`, epoch ms) acabar. So lanca FirecrawlError quando nenhuma URL deu certo.
   */
  async aggregate(sourceUrls: string[], deadline = Number.POSITIVE_INFINITY): Promise<AggregatedExtraction> {
    const result: AggregatedExtraction = { sourceUrls: [...sourceUrls], meta: {}, pois: [], costs: null, failures: [] };
    let attempted = 0;
    for (const url of sourceUrls) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < MIN_SCRAPE_WINDOW_MS) break;
      attempted += 1;
      let payload: Record<string, unknown>;
      try {
        payload = await this.scrape(url, Math.min(this.scrapeTimeoutMs, remainingMs));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Firecrawl scrape falhou para url=${url}: ${message}`);
        result.failures.push({ url, error: message });
        continue;
      }
      for (const key of META_KEYS) {
        if (payload[key] && !result.meta[key]) result.meta[key] = payload[key];
      }
      if (!result.costs && payload.costs && typeof payload.costs === 'object') result.costs = payload.costs as ExtractedCosts;
      for (const poi of Array.isArray(payload.pois) ? payload.pois : []) {
        if (poi && typeof poi === 'object') result.pois.push({ ...(poi as ExtractedPoi), source_url: url });
      }
      if (result.meta.summary && result.pois.length > 0) break;
    }
    if (attempted === 0) throw new FirecrawlError('Tempo da descoberta esgotado antes do scrape.');
    if (result.failures.length === attempted) {
      throw new FirecrawlError(`Todas as ${attempted} URLs falharam no scrape: ${result.failures[result.failures.length - 1].error}`);
    }
    return result;
  }

  /**
   * Busca URLs, faz o scrape e cai para a Wikipedia quando a busca nao rende, tudo dentro de
   * FIRECRAWL_DISCOVERY_BUDGET segundos. Devolve null se nada funcionar.
   */
  async discover(query: string, country = '', region = ''): Promise<AggregatedExtraction | null> {
    if (!this.isConfigured()) return null;
    if (this.isCircuitOpen()) {
      this.logger.log(`Firecrawl com circuit aberto, pulando (query=${query})`);
      return null;
    }
    const deadline = Date.now() + this.discoveryBudgetMs;
    let urls: string[] = [];
    try {
      urls = await this.searchUrls(query, country, Math.min(this.searchTimeoutMs, this.discoveryBudgetMs));
    } catch (error) {
      this.logger.warn(`Firecrawl search falhou para query=${query}: ${error instanceof Error ? error.message : String(error)}`);
      this.recordFailure();
    }
    const wiki = wikipediaFallbackUrl(query, region);
    if (urls.length === 0) urls = [wiki];

    for (const batch of urls.includes(wiki) ? [urls] : [urls, [wiki]]) {
      try {
        const result = await this.aggregate(batch, deadline);
        this.recordSuccess();
        return result;
      } catch (error) {
        this.recordFailure();
        this.logger.warn(`Firecrawl falhou em ${batch.length} URL(s) para query=${query}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return null;
  }

  isRecentlyFailed(slug: string): boolean {
    return this.cache.get(`discover_failed:${slug}`) === true;
  }

  markRecentlyFailed(slug: string): void {
    this.cache.set(`discover_failed:${slug}`, true, this.failureTtlMs);
  }

  isCircuitOpen(): boolean {
    return this.cache.get('circuit_open') === true;
  }

  recordFailure(): void {
    const count = Number(this.cache.get('recent_failures') ?? 0) + 1;
    this.cache.set('recent_failures', count, CIRCUIT_WINDOW_MS);
    if (count >= CIRCUIT_THRESHOLD) {
      this.cache.set('circuit_open', true, CIRCUIT_OPEN_MS);
      this.cache.delete('recent_failures');
      this.logger.warn(`Firecrawl circuit breaker aberto por ${CIRCUIT_OPEN_MS / 1000}s (>= ${CIRCUIT_THRESHOLD} falhas)`);
    }
  }

  recordSuccess(): void {
    this.cache.delete('recent_failures');
    this.cache.delete('circuit_open');
  }
}
