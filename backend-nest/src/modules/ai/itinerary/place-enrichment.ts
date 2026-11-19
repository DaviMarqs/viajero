import type { PointOfInterest } from '../../destinations/entities';
import { cleanImageUrl, cleanUrl } from '../../destinations/discovery/slug';
import type { GeneratedItinerary } from '../itinerary-generators';
import type { PlaceLink } from './itinerary-details';
import { mapLimit } from './pipeline/shared';
import { PlaceChain, PlaceInfo, mapsLink } from './places/place-provider';

type Event = GeneratedItinerary['days'][number]['events'][number];

const SKIP_LOOKUP = new Set(['transport', 'free_time']);
const MAX_LOOKUPS = 25;
const CONCURRENCY = 4;

export interface PlaceEnrichmentStats {
  looked_up: number;
  found: number;
  images: number;
  websites: number;
  providers: string[];
  warnings: string[];
}

/** source_url do seed costuma ser uma busca do Google: nao e o site do lugar. */
const realWebsite = (value: unknown) => {
  const url = cleanUrl(value, 300);
  return url && !/google\.[^/]+\/search/i.test(url) ? url : '';
};

const keyOf = (name: string) => name.trim().toLowerCase();

/**
 * Links, foto, nota e faixa de preco de cada evento. Todo evento com lugar ganha o link do Google Maps
 * (busca publica, sem chave); os demais dados vem da cadeia de provedores, no maximo 25 lugares por roteiro.
 * Nunca lanca: falha so deixa o evento com o link de busca.
 */
export async function enrichPlaces(
  result: GeneratedItinerary,
  options: { pois: PointOfInterest[]; destination: { name: string; city?: string | null; country?: string | null }; places?: PlaceChain },
): Promise<PlaceEnrichmentStats> {
  const city = options.destination.city || options.destination.name;
  const country = options.destination.country ?? '';
  const poisById = new Map(options.pois.map((poi) => [Number(poi.id), poi]));
  const stats: PlaceEnrichmentStats = { looked_up: 0, found: 0, images: 0, websites: 0, providers: options.places?.keys ?? [], warnings: [] };

  const events = result.days.flatMap((day, dayIndex) => day.events.map((event) => ({ event, dayNumber: dayIndex + 1 })));
  const placeName = (event: Event) => event.details?.place_name || (event.poi_id !== undefined ? poisById.get(event.poi_id)?.name : undefined);

  // Uma busca por lugar distinto, na ordem do roteiro.
  const wanted = new Map<string, { name: string; kind?: string; website?: string }>();
  for (const { event } of events) {
    const name = placeName(event);
    if (!name || SKIP_LOOKUP.has(event.details?.kind ?? '') || wanted.has(keyOf(name))) continue;
    if (wanted.size >= MAX_LOOKUPS) break;
    const poi = event.poi_id !== undefined ? poisById.get(event.poi_id) : undefined;
    wanted.set(keyOf(name), { name, kind: event.details?.kind, website: realWebsite(poi?.source_url) || undefined });
  }

  const found = new Map<string, PlaceInfo | null>();
  if (options.places && wanted.size > 0) {
    const places = options.places;
    const entries = [...wanted.entries()];
    await mapLimit(entries, CONCURRENCY, async ([key, item]) => {
      stats.looked_up += 1;
      const info = await places
        .lookup({ name: item.name, city, country, kind: item.kind as never, website: item.website })
        .catch(() => null);
      found.set(key, info);
    });
  }

  for (const { event, dayNumber } of events) {
    const details = { ...(event.details ?? {}) };
    const name = placeName(event);
    const poi = event.poi_id !== undefined ? poisById.get(event.poi_id) : undefined;
    const info = name ? found.get(keyOf(name)) ?? null : null;
    const links: PlaceLink[] = [];
    const mapsTarget = name || details.location;
    if (mapsTarget) links.push(mapsLink(mapsTarget, city, country));
    const website = info?.website || realWebsite(poi?.source_url);
    if (website) links.push({ kind: 'website', label: 'Site oficial', url: website });
    for (const link of info?.links ?? []) if (!links.some((item) => item.url === link.url)) links.push(link);
    if (links.length > 0) details.links = links;

    const poiImage = cleanImageUrl(poi?.metadata?.image_url);
    if (info?.image_url) {
      details.image_url = info.image_url;
      if (info.image_credit) details.image_credit = info.image_credit;
    } else if (poiImage) {
      details.image_url = poiImage;
      const credit = cleanUrl(poi?.metadata?.image_source);
      details.image_credit = { label: credit ? new URL(credit).hostname.replace(/^www\./, '') : 'cadastro do local', ...(credit ? { url: credit } : {}) };
    }
    if (info?.coordinates) details.coordinates = info.coordinates;
    if (info?.rating) details.rating = info.rating;
    if (info?.price_tier) details.price_tier = info.price_tier;
    event.details = details;

    // Faixa de preco do provedor contradiz a referencia usada no custo da refeicao.
    const tier = info?.price_tier?.tier;
    if (tier && details.kind === 'meal') {
      if (tier >= 3 && details.cost_basis === 'meal_budget') {
        stats.warnings.push(`Dia ${dayNumber}: "${event.title}" é caro segundo ${info?.price_tier?.provider}, mas o custo usa a refeição econômica.`);
      } else if (tier === 1 && details.cost_basis === 'meal_high') {
        stats.warnings.push(`Dia ${dayNumber}: "${event.title}" é barato segundo ${info?.price_tier?.provider}, mas o custo usa a refeição sofisticada.`);
      }
    }
  }

  for (const info of found.values()) {
    if (!info) continue;
    stats.found += 1;
    if (info.image_url) stats.images += 1;
    if (info.website) stats.websites += 1;
  }
  return stats;
}
