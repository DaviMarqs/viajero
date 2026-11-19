import { parseCost } from './itinerary-costs';

/**
 * Detalhes ricos do roteiro (tipo do evento, dicas, plano B, guia da viagem). Ficam em colunas jsonb
 * (`details` do dia e do evento) e em `itinerary.metadata.trip_guide`, entao tudo aqui e opcional
 * e tolerante: o que o LLM manda fora do formato e descartado, nunca derruba a geracao.
 */

export const EVENT_KINDS = ['attraction', 'meal', 'transport', 'lodging', 'activity', 'shopping', 'nightlife', 'free_time'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface TransitInfo {
  mode: string;
  minutes?: number;
  note?: string;
}

/** Em qual referencia o LLM se baseou para o custo do evento. */
export const COST_BASES = [
  'meal_budget', 'meal_mid', 'meal_high', 'public_transport_ride', 'taxi_short', 'hotel_night', 'attraction_ticket', 'poi_ticket', 'estimate',
] as const;
export type CostBasis = (typeof COST_BASES)[number];

/** De onde veio o valor do evento (mostrado no front). */
export interface CostSource {
  basis: CostBasis | 'free';
  label: string;
  /** Valor de referencia (antes do ajuste ao orcamento). */
  reference?: string;
  /** A referencia e por pessoa e o custo e do grupo: `reference x travelers`. */
  travelers?: number;
  source_url?: string;
  /** Preenchido quando o applyBudgetPrecision reescalou o custo. */
  adjusted?: { original: string; factor: number };
}

export interface PlaceLink {
  kind: 'maps' | 'website' | 'reviews' | 'osm';
  label: string;
  url: string;
}

export interface EventDetails {
  kind?: EventKind;
  location?: string;
  tip?: string;
  booking_required?: boolean;
  booking_note?: string;
  transit_to_next?: TransitInfo;
  /** Nome exato do estabelecimento (vazio quando o evento e generico). */
  place_name?: string;
  cost_basis?: CostBasis;
  cost_source?: CostSource;
  // Preenchidos pelo enriquecimento de lugares (nunca aceitos do LLM).
  links?: PlaceLink[];
  image_url?: string;
  image_credit?: { label: string; url?: string };
  coordinates?: { lat: number; lon: number };
  rating?: { value: number; scale: number; provider: string };
  price_tier?: { tier: number; provider: string };
}

export interface DayAlternative {
  title: string;
  description?: string;
  estimated_cost?: string;
}

export interface DayDetails {
  date?: string;
  weekday?: string;
  theme?: string;
  area?: string;
  rain_plan?: string;
  alternatives?: DayAlternative[];
  tips?: string[];
}

export interface CostBenchmarks {
  meal_budget?: string;
  meal_mid?: string;
  meal_high?: string;
  public_transport_ride?: string;
  taxi_short?: string;
  hotel_night?: string;
  attraction_ticket?: string;
}

export interface GuideNeighborhood {
  name: string;
  description?: string;
}

export interface TripGuide {
  overview?: string;
  weather?: string;
  getting_around?: string;
  neighborhoods?: GuideNeighborhood[];
  money?: string;
  safety?: string;
  etiquette?: string;
  packing?: string[];
  phrases?: string[];
  local_events?: string[];
  documents_health?: string;
  cost_benchmarks?: CostBenchmarks;
  /** Pagina usada como base dos custos de referencia; ausente = media estimada pela IA. */
  cost_benchmarks_source?: string;
  sources?: string[];
}

type RawObject = Record<string, unknown>;

export const isObject = (value: unknown): value is RawObject => !!value && typeof value === 'object' && !Array.isArray(value);

export const asObjects = (value: unknown): RawObject[] => (Array.isArray(value) ? value.filter(isObject) : []);

/** Texto aparado e cortado; numeros viram texto; o resto vira ''. */
export const text = (value: unknown, max: number): string =>
  (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '').slice(0, max);

/** Lista de textos nao vazios (aceita tambem uma string unica). */
export function textList(value: unknown, maxItems: number, maxLength: number): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return items.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

/** Remove chaves vazias (undefined, '', [] e objetos vazios). */
export function compact<T extends object>(value: T): T {
  const entries = Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === '') return false;
    if (Array.isArray(item)) return item.length > 0;
    if (isObject(item)) return Object.keys(item).length > 0;
    return true;
  });
  return Object.fromEntries(entries) as T;
}

const KIND_ALIASES: Record<string, EventKind> = {
  attraction: 'attraction', atracao: 'attraction', passeio: 'attraction', sightseeing: 'attraction', museum: 'attraction', museu: 'attraction', visita: 'attraction', landmark: 'attraction', culture: 'attraction', cultura: 'attraction',
  meal: 'meal', refeicao: 'meal', food: 'meal', restaurant: 'meal', restaurante: 'meal', comida: 'meal', breakfast: 'meal', lunch: 'meal', dinner: 'meal', cafe: 'meal', almoco: 'meal', jantar: 'meal', gastronomia: 'meal',
  transport: 'transport', transporte: 'transport', transfer: 'transport', deslocamento: 'transport', transit: 'transport', travel: 'transport',
  lodging: 'lodging', hospedagem: 'lodging', hotel: 'lodging', accommodation: 'lodging', hostel: 'lodging', pousada: 'lodging', checkin: 'lodging',
  activity: 'activity', atividade: 'activity', tour: 'activity', experience: 'activity', experiencia: 'activity', adventure: 'activity', aventura: 'activity', nature: 'activity', natureza: 'activity', wellness: 'activity',
  shopping: 'shopping', compras: 'shopping', market: 'shopping', mercado: 'shopping', feira: 'shopping',
  nightlife: 'nightlife', 'vida noturna': 'nightlife', bar: 'nightlife', show: 'nightlife', balada: 'nightlife',
  free_time: 'free_time', livre: 'free_time', 'tempo livre': 'free_time', descanso: 'free_time', rest: 'free_time', free: 'free_time',
};

/** Aceita aliases em pt/en, com ou sem acento; desconhecido vira undefined. */
export function normalizeKind(value: unknown): EventKind | undefined {
  const key = text(value, 40)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-]/g, ' ')
    .trim();
  if (!key) return undefined;
  return KIND_ALIASES[key] ?? KIND_ALIASES[key.replace(/ /g, '_')] ?? KIND_ALIASES[key.replace(/_/g, ' ')];
}

const minutesOf = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(text(value, 10).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 600) : undefined;
};

const booleanOf = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  const key = text(value, 10).toLowerCase();
  if (['true', 'sim', 'yes', '1'].includes(key)) return true;
  if (['false', 'nao', 'não', 'no', '0'].includes(key)) return false;
  return undefined;
};

export function normalizeTransit(value: unknown): TransitInfo | undefined {
  if (!isObject(value)) return undefined;
  const mode = text(value.mode, 40);
  if (!mode) return undefined;
  return compact({ mode, minutes: minutesOf(value.minutes), note: text(value.note, 200) || undefined });
}

/** Le os detalhes de um evento do LLM (campos soltos no evento ou dentro de `details`). Links e fotos do LLM sao ignorados. */
export function normalizeEventDetails(event: RawObject): EventDetails {
  const source: RawObject = isObject(event.details) ? { ...event, ...event.details } : event;
  const basis = text(source.cost_basis, 30).toLowerCase();
  return compact({
    kind: normalizeKind(source.kind),
    place_name: text(source.place_name, 160) || undefined,
    cost_basis: (COST_BASES as readonly string[]).includes(basis) ? (basis as CostBasis) : undefined,
    location: text(source.location, 200) || undefined,
    tip: text(source.tip, 400) || undefined,
    booking_required: booleanOf(source.booking_required),
    booking_note: text(source.booking_note, 300) || undefined,
    transit_to_next: normalizeTransit(source.transit_to_next),
  });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDayDetails(day: RawObject): DayDetails {
  const source: RawObject = isObject(day.details) ? { ...day, ...day.details } : day;
  const date = text(source.date, 10);
  return compact({
    date: DATE.test(date) ? date : undefined,
    weekday: text(source.weekday, 20) || undefined,
    theme: text(source.theme, 120) || undefined,
    area: text(source.area, 160) || undefined,
    rain_plan: text(source.rain_plan, 800) || undefined,
    alternatives: asObjects(source.alternatives)
      .map((item) =>
        compact({
          title: text(item.title, 160),
          description: text(item.description, 400) || undefined,
          estimated_cost: item.estimated_cost === undefined || item.estimated_cost === null ? undefined : parseCost(item.estimated_cost).toFixed(2),
        }),
      )
      .filter((item) => item.title)
      .slice(0, 3),
    tips: textList(source.tips, 5, 300),
  });
}

const costOrUndefined = (value: unknown) => {
  const cost = parseCost(value);
  return cost > 0 ? cost.toFixed(2) : undefined;
};

export function normalizeCostBenchmarks(value: unknown): CostBenchmarks | undefined {
  if (!isObject(value)) return undefined;
  const benchmarks = compact<CostBenchmarks>({
    meal_budget: costOrUndefined(value.meal_budget),
    meal_mid: costOrUndefined(value.meal_mid),
    meal_high: costOrUndefined(value.meal_high),
    public_transport_ride: costOrUndefined(value.public_transport_ride),
    taxi_short: costOrUndefined(value.taxi_short),
    hotel_night: costOrUndefined(value.hotel_night),
    attraction_ticket: costOrUndefined(value.attraction_ticket),
  });
  return Object.keys(benchmarks).length > 0 ? benchmarks : undefined;
}

/** Normaliza o guia; devolve undefined quando nao sobra nada util. */
export function normalizeTripGuide(value: unknown, sources: string[] = []): TripGuide | undefined {
  if (!isObject(value)) return undefined;
  const guide = compact<TripGuide>({
    overview: text(value.overview, 1200) || undefined,
    weather: text(value.weather, 800) || undefined,
    getting_around: text(value.getting_around, 1000) || undefined,
    neighborhoods: asObjects(value.neighborhoods)
      .map((item) => compact({ name: text(item.name, 120), description: text(item.description, 300) || undefined }))
      .filter((item) => item.name)
      .slice(0, 8),
    money: text(value.money, 800) || undefined,
    safety: text(value.safety, 800) || undefined,
    etiquette: text(value.etiquette, 800) || undefined,
    packing: textList(value.packing, 12, 160),
    phrases: textList(value.phrases, 10, 160),
    local_events: textList(value.local_events, 6, 300),
    documents_health: text(value.documents_health, 800) || undefined,
    cost_benchmarks: normalizeCostBenchmarks(value.cost_benchmarks),
  });
  if (Object.keys(guide).length === 0) return undefined;
  const allSources = [...new Set([...textList(value.sources, 6, 300), ...sources])].filter((source) => /^https?:\/\//.test(source));
  return allSources.length > 0 ? { ...guide, sources: allSources } : guide;
}
