import { cleanImageUrl, cleanUrl } from '../../../destinations/discovery/slug';
import type { FetchFn } from '../../llm/llm-provider';
import { PlaceField, PlaceInfo, PlaceProvider, PlaceQuery, readJson, sameName } from './place-provider';

const BASE_URL = 'https://places-api.foursquare.com/places/search';
const API_VERSION = '2025-06-17';
const TIMEOUT_MS = 6000;
const FIELDS = 'fsq_place_id,name,latitude,longitude,website,rating,price,photos';

interface FoursquarePlace {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  rating?: number;
  price?: number;
  photos?: Array<{ prefix?: string; suffix?: string }>;
}

/** Foursquare Places API (paga, com cota gratuita): fotos reais, site, nota (0-10) e faixa de preco (1-4). */
export class FoursquarePlaceProvider implements PlaceProvider {
  readonly key = 'foursquare';

  constructor(private readonly apiKey: string, private readonly fetchFn: FetchFn = fetch) {}

  async lookup(query: PlaceQuery, missing: Set<PlaceField>): Promise<PlaceInfo | null> {
    void missing; // Uma chamada so traz tudo.
    const params = new URLSearchParams({ query: query.name, near: [query.city, query.country].filter(Boolean).join(', '), limit: '3', fields: FIELDS });
    const response = await this.fetchFn(`${BASE_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, 'X-Places-Api-Version': API_VERSION, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await readJson(response, 'Foursquare')) as { results?: FoursquarePlace[] };
    const place = (body.results ?? []).find((item) => item.name && sameName(query.name, item.name));
    if (!place) return null;

    const info: PlaceInfo = { links: [] };
    if (typeof place.latitude === 'number' && typeof place.longitude === 'number') info.coordinates = { lat: place.latitude, lon: place.longitude };
    const website = cleanUrl(place.website, 300);
    if (website) info.website = website;
    const photo = place.photos?.find((item) => item.prefix && item.suffix);
    const pageUrl = place.fsq_place_id ? `https://foursquare.com/v/${encodeURIComponent(place.fsq_place_id)}` : undefined;
    if (photo) {
      const imageUrl = cleanImageUrl(`${photo.prefix}original${photo.suffix}`);
      if (imageUrl) {
        info.image_url = imageUrl;
        info.image_credit = { label: 'Foursquare', url: pageUrl };
      }
    }
    if (typeof place.rating === 'number' && place.rating > 0) info.rating = { value: Math.round(place.rating * 10) / 10, scale: 10, provider: 'Foursquare' };
    if (typeof place.price === 'number' && place.price >= 1 && place.price <= 4) info.price_tier = { tier: place.price, provider: 'Foursquare' };
    if (pageUrl) info.links = [{ kind: 'reviews', label: 'Ver no Foursquare', url: pageUrl }];
    return info;
  }
}
