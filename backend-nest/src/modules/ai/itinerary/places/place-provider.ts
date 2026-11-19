import { Logger } from '@nestjs/common';
import { TtlCache } from '../../../destinations/discovery/ttl-cache';
import type { EventKind, PlaceLink } from '../itinerary-details';

/**
 * Busca de foto, site, nota e faixa de preco de um lugar (restaurante, hotel, atracao).
 * Varios provedores em cadeia, como os LLMs: cada um completa o que os anteriores nao acharam.
 * So o nome do lugar e a cidade saem daqui; nenhum dado do usuario.
 */

export interface PlaceQuery {
  name: string;
  city: string;
  country: string;
  kind?: EventKind;
  /** Site ja conhecido (do POI ou de um provedor anterior), usado para a foto do og:image. */
  website?: string;
}

export type PlaceField = 'image' | 'website' | 'coordinates' | 'rating' | 'price' | 'reviews';

export interface PlaceInfo {
  coordinates?: { lat: number; lon: number };
  website?: string;
  image_url?: string;
  image_credit?: { label: string; url?: string };
  rating?: { value: number; scale: number; provider: string };
  price_tier?: { tier: number; provider: string };
  links?: PlaceLink[];
}

export interface PlaceProvider {
  readonly key: string;
  /** `missing`: o que ainda falta; o provedor pode pular chamadas extras (ex.: fotos). */
  lookup(query: PlaceQuery, missing: Set<PlaceField>): Promise<PlaceInfo | null>;
}

/** Credencial invalida ou cota esgotada: o provedor sai da cadeia ate o fim do processo de geracao. */
export class PlaceProviderUnavailableError extends Error {}

export const PLACE_USER_AGENT = 'Viajero/1.0 (https://github.com/DaviMarqs/viajero) itinerary-places';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ');

const STOP_WORDS = new Set(['the', 'and', 'restaurante', 'restaurant', 'hotel', 'cafe', 'bar', 'museu', 'museum', 'casa', 'das', 'dos', 'del', 'des']);
const tokens = (value: string) => normalize(value).split(/\s+/).filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

/** O resultado do provedor e o lugar pedido? Pelo menos metade das palavras relevantes do nome aparece no resultado. */
export function sameName(wanted: string, found: string): boolean {
  const want = tokens(wanted);
  if (want.length === 0) return normalize(found).includes(normalize(wanted).trim());
  const have = new Set(tokens(found));
  const hits = want.filter((token) => have.has(token) || [...have].some((item) => item.startsWith(token) || token.startsWith(item))).length;
  return hits >= Math.ceil(want.length / 2);
}

export function mapsLink(name: string, city: string, country: string): PlaceLink {
  const query = [name, city, country].filter(Boolean).join(', ');
  return { kind: 'maps', label: 'Ver no Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` };
}

const FIELDS: PlaceField[] = ['image', 'website', 'coordinates', 'rating', 'price', 'reviews'];

function missingFields(info: PlaceInfo): Set<PlaceField> {
  const has: Record<PlaceField, boolean> = {
    image: !!info.image_url,
    website: !!info.website,
    coordinates: !!info.coordinates,
    rating: !!info.rating,
    price: !!info.price_tier,
    reviews: (info.links ?? []).some((link) => link.kind === 'reviews'),
  };
  return new Set(FIELDS.filter((field) => !has[field]));
}

/** Junta o que o provedor trouxe sem sobrescrever o que ja veio de um provedor anterior. */
export function mergePlaceInfo(base: PlaceInfo, extra: PlaceInfo): PlaceInfo {
  const merged: PlaceInfo = { ...base };
  if (!merged.coordinates && extra.coordinates) merged.coordinates = extra.coordinates;
  if (!merged.website && extra.website) merged.website = extra.website;
  if (!merged.image_url && extra.image_url) {
    merged.image_url = extra.image_url;
    merged.image_credit = extra.image_credit;
  }
  if (!merged.rating && extra.rating) merged.rating = extra.rating;
  if (!merged.price_tier && extra.price_tier) merged.price_tier = extra.price_tier;
  const links = [...(merged.links ?? [])];
  for (const link of extra.links ?? []) if (!links.some((item) => item.url === link.url)) links.push(link);
  if (links.length > 0) merged.links = links;
  return merged;
}

const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const sharedCache = new TtlCache<PlaceInfo | null>();

export class PlaceChain {
  private readonly logger = new Logger(PlaceChain.name);
  private readonly unavailable = new Set<string>();

  constructor(
    readonly providers: PlaceProvider[],
    private readonly cache: TtlCache<PlaceInfo | null> = sharedCache,
  ) {}

  get keys(): string[] {
    return this.providers.map((provider) => provider.key);
  }

  /** Tenta os provedores em ordem ate ter tudo; erro de um provedor nunca derruba a busca. */
  async lookup(query: PlaceQuery): Promise<PlaceInfo | null> {
    const cacheKey = [query.name, query.city, query.country, query.kind ?? ''].join('|').toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    let info: PlaceInfo = {};
    let found = false;
    let failed = false;
    for (const provider of this.providers) {
      if (this.unavailable.has(provider.key)) continue;
      const missing = missingFields(info);
      if (missing.size === 0) break;
      try {
        const extra = await provider.lookup({ ...query, website: info.website ?? query.website }, missing);
        if (extra) {
          info = mergePlaceInfo(info, extra);
          found = true;
        }
      } catch (error) {
        failed = true;
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof PlaceProviderUnavailableError) {
          this.unavailable.add(provider.key);
          this.logger.warn(`${provider.key} indisponivel (${message}); seguindo sem ele.`);
        } else {
          this.logger.warn(`${provider.key} falhou para "${query.name}": ${message}`);
        }
      }
    }
    const result = found ? info : null;
    // Falha de rede nao vira cache negativo longo: so o "nao encontrado" de verdade.
    if (result || !failed) this.cache.set(cacheKey, result, result ? HIT_TTL_MS : MISS_TTL_MS);
    return result;
  }
}

export async function readJson(response: Response, provider: string): Promise<unknown> {
  if (response.status === 401 || response.status === 403) throw new PlaceProviderUnavailableError(`${provider}: credencial recusada (HTTP ${response.status})`);
  if (response.status === 429 || response.status === 402) throw new PlaceProviderUnavailableError(`${provider}: cota esgotada (HTTP ${response.status})`);
  if (!response.ok) throw new Error(`${provider}: HTTP ${response.status}`);
  return response.json();
}
