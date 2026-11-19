import { cleanImageUrl, cleanUrl } from '../../../destinations/discovery/slug';
import { filterReachableImages } from '../../../destinations/discovery/image-check';
import type { FetchFn } from '../../llm/llm-provider';
import { PLACE_USER_AGENT, PlaceField, PlaceInfo, PlaceProvider, PlaceQuery, sameName } from './place-provider';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 6000;
const SITE_TIMEOUT_MS = 5000;
const MAX_HTML_CHARS = 300_000;
/** Politica do Nominatim: no maximo 1 requisicao por segundo. */
const MIN_INTERVAL_MS = 1100;

interface NominatimResult {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  osm_type?: string;
  osm_id?: number | string;
  extratags?: Record<string, string>;
}

/** og:image / twitter:image do HTML (aspas simples ou duplas, qualquer ordem de atributos), resolvido pela URL da pagina. */
export function extractOgImage(html: string, pageUrl: string): string {
  const head = html.slice(0, MAX_HTML_CHARS);
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const property = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!property || !['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(property)) continue;
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim();
    if (!content) continue;
    try {
      const resolved = cleanImageUrl(new URL(content.replace(/&amp;/g, '&'), pageUrl).toString());
      if (resolved) return resolved;
    } catch {
      continue;
    }
  }
  return '';
}

/**
 * OpenStreetMap (Nominatim, gratuito e sem chave) para coordenadas, site e link do OSM; a foto vem do
 * og:image do site oficial, conferida como imagem acessivel. Fecha a cadeia sempre.
 */
export class OsmPlaceProvider implements PlaceProvider {
  readonly key = 'osm';
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  /** Serializa as chamadas ao Nominatim respeitando o intervalo minimo. */
  private throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastCall + MIN_INTERVAL_MS - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastCall = this.now();
      return task();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async lookup(query: PlaceQuery, missing: Set<PlaceField>): Promise<PlaceInfo | null> {
    const params = new URLSearchParams({
      q: [query.name, query.city, query.country].filter(Boolean).join(', '),
      format: 'jsonv2', limit: '3', extratags: '1', addressdetails: '0',
    });
    const results = await this.throttled(async () => {
      const response = await this.fetchFn(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { 'User-Agent': PLACE_USER_AGENT, Accept: 'application/json', 'Accept-Language': 'pt-BR,pt,en' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`);
      return (await response.json()) as NominatimResult[];
    });
    const place = (Array.isArray(results) ? results : []).find((item) => sameName(query.name, item.name || item.display_name || ''));
    const knownWebsite = cleanUrl(query.website, 300);
    if (!place && !knownWebsite) return null;

    const info: PlaceInfo = { links: [] };
    const tags = place?.extratags ?? {};
    if (place) {
      const lat = Number(place.lat);
      const lon = Number(place.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) info.coordinates = { lat, lon };
      const website = cleanUrl(tags.website || tags['contact:website'] || tags.url, 300);
      if (website) info.website = website;
      if (place.osm_type && place.osm_id) {
        info.links = [{ kind: 'osm', label: 'OpenStreetMap', url: `https://www.openstreetmap.org/${encodeURIComponent(place.osm_type)}/${encodeURIComponent(String(place.osm_id))}` }];
      }
    }
    if (missing.has('image')) {
      const site = knownWebsite || info.website || '';
      const tagged = cleanImageUrl(tags.image);
      const fromSite = !tagged && site ? await this.siteImage(site) : '';
      const candidate = tagged || fromSite;
      if (candidate && (await filterReachableImages([candidate], this.fetchFn)).has(candidate)) {
        info.image_url = candidate;
        info.image_credit = tagged ? { label: 'OpenStreetMap', url: info.links?.[0]?.url } : { label: new URL(site).hostname.replace(/^www./, ''), url: site };
      }
    }
    return info.coordinates || info.website || info.image_url || info.links?.length ? info : null;
  }

  /** Foto de divulgacao do site oficial (og:image). */
  async siteImage(website: string): Promise<string> {
    try {
      const response = await this.fetchFn(website, {
        headers: { 'User-Agent': PLACE_USER_AGENT, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      });
      if (!response.ok || !(response.headers.get('content-type') ?? 'text/html').includes('html')) return '';
      return extractOgImage(await response.text(), response.url || website);
    } catch {
      return '';
    }
  }
}
