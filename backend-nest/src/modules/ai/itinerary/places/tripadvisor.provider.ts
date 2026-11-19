import { cleanImageUrl, cleanUrl } from '../../../destinations/discovery/slug';
import type { FetchFn } from '../../llm/llm-provider';
import { PlaceField, PlaceInfo, PlaceProvider, PlaceQuery, readJson, sameName } from './place-provider';

const BASE_URL = 'https://api.content.tripadvisor.com/api/v1/location';
const TIMEOUT_MS = 6000;

const CATEGORY: Record<string, string> = { meal: 'restaurants', lodging: 'hotels', attraction: 'attractions', activity: 'attractions', nightlife: 'restaurants' };

interface TripadvisorLocation {
  location_id?: string | number;
  name?: string;
}

interface TripadvisorDetails {
  web_url?: string;
  website?: string;
  rating?: string | number;
  price_level?: string;
  latitude?: string | number;
  longitude?: string | number;
}

/** "$$ - $$$" -> 2 (o menor nivel da faixa). */
export function priceLevelTier(value: unknown): number | undefined {
  const match = /\$+/.exec(typeof value === 'string' ? value : '');
  return match ? Math.min(match[0].length, 4) : undefined;
}

/**
 * Tripadvisor Content API (paga, com cota gratuita): busca + detalhes (+ fotos se ainda faltar foto).
 * Traz o link das avaliacoes, nota (0-5), faixa de preco e site.
 */
export class TripadvisorPlaceProvider implements PlaceProvider {
  readonly key = 'tripadvisor';

  constructor(private readonly apiKey: string, private readonly fetchFn: FetchFn = fetch) {}

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const query = new URLSearchParams({ key: this.apiKey, language: 'pt', ...params });
    const response = await this.fetchFn(`${BASE_URL}${path}?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return readJson(response, 'Tripadvisor');
  }

  async lookup(query: PlaceQuery, missing: Set<PlaceField>): Promise<PlaceInfo | null> {
    const params: Record<string, string> = { searchQuery: `${query.name} ${query.city}`.trim() };
    const category = query.kind ? CATEGORY[query.kind] : undefined;
    if (category) params.category = category;
    const search = (await this.get('/search', params)) as { data?: TripadvisorLocation[] };
    const location = (search.data ?? []).find((item) => item.name && item.location_id && sameName(query.name, item.name));
    if (!location) return null;
    const id = encodeURIComponent(String(location.location_id));

    const details = (await this.get(`/${id}/details`, {})) as TripadvisorDetails;
    const info: PlaceInfo = {};
    const lat = Number(details.latitude);
    const lon = Number(details.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) info.coordinates = { lat, lon };
    const website = cleanUrl(details.website, 300);
    if (website) info.website = website;
    const rating = Number(details.rating);
    if (Number.isFinite(rating) && rating > 0) info.rating = { value: rating, scale: 5, provider: 'Tripadvisor' };
    const tier = priceLevelTier(details.price_level);
    if (tier) info.price_tier = { tier, provider: 'Tripadvisor' };
    const pageUrl = cleanUrl(details.web_url, 300);
    if (pageUrl) info.links = [{ kind: 'reviews', label: 'Avaliações no Tripadvisor', url: pageUrl }];

    if (missing.has('image')) {
      const photos = (await this.get(`/${id}/photos`, { limit: '1' }).catch(() => ({}))) as {
        data?: Array<{ images?: Record<string, { url?: string }> }>;
      };
      const images = photos.data?.[0]?.images ?? {};
      const imageUrl = cleanImageUrl(images.large?.url ?? images.original?.url ?? images.medium?.url);
      if (imageUrl) {
        info.image_url = imageUrl;
        info.image_credit = { label: 'Tripadvisor', url: pageUrl || undefined };
      }
    }
    return info;
  }
}
