import type { Poi } from "@/lib/pois";
export type TravelTag = string;

export interface LocationSummary {
  city?: string | null;
  country?: string | null;
}

export interface Destination {
  [key: string]: unknown;
  id: number | string;
  name: string;
  slug?: string;
  city?: string | null;
  country?: string | null;
  summary?: string | null;
  hero_image_url?: string | null;
  timezone?: string | null;
  best_season?: string | null;
  average_rating?: number | string | null;
  cost_profile?: string | { daily_budget_mid?: string | number | null; currency_code?: string;[key: string]: unknown; } | null;
  metadata?: Record<string, unknown> | null;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  cover_image?: string | null;
  cost?: number | string | null;
  cost_from?: number | string | null;
  rating?: number | string | null;
  duration_days?: number | string | null;
  duration?: number | string | null;
  tags?: TravelTag[] | string | null;
  pois?: Poi[] | null;
  points_of_interest?: Poi[] | null;
}

/** Tipo do evento gerado pela IA (backend: itinerary-details.ts). */
export type EventKind = "attraction" | "meal" | "transport" | "lodging" | "activity" | "shopping" | "nightlife" | "free_time";

/** De onde veio o valor do evento (backend: cost-sources.ts). */
export interface CostSource {
  basis: string;
  label: string;
  reference?: string;
  travelers?: number;
  source_url?: string;
  adjusted?: { original: string; factor: number };
}

export interface PlaceLink {
  kind: "maps" | "website" | "reviews" | "osm";
  label: string;
  url: string;
}

export interface EventDetails {
  kind?: EventKind;
  location?: string;
  tip?: string;
  booking_required?: boolean;
  booking_note?: string;
  transit_to_next?: { mode: string; minutes?: number; note?: string };
  place_name?: string;
  cost_source?: CostSource;
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

export interface TripGuide {
  overview?: string;
  weather?: string;
  getting_around?: string;
  neighborhoods?: Array<{ name: string; description?: string }>;
  money?: string;
  safety?: string;
  etiquette?: string;
  packing?: string[];
  phrases?: string[];
  local_events?: string[];
  documents_health?: string;
  cost_benchmarks?: Record<string, string>;
  cost_benchmarks_source?: string;
  sources?: string[];
}

export interface ItineraryEvent {
  [key: string]: unknown;
  id: number | string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  estimated_cost?: number | string | null;
  order_index?: number | null;
  itinerary_day?: number | string | null;
  poi?: Destination | Record<string, unknown> | null;
  details?: EventDetails | null;
}

export interface ItineraryDay {
  [key: string]: unknown;
  id: number | string;
  day_number: number;
  title: string;
  summary?: string | null;
  estimated_cost?: number | string | null;
  itinerary?: number | string | null;
  details?: DayDetails | null;
  events: ItineraryEvent[];
}

export interface ReviewStats {
  id?: number | string;
  review_count: number;
  average_rating: number | string;
}

export interface ReviewAuthor {
  id: number;
  display_name: string;
  avatar_url?: string | null;
}

export interface Review {
  id: number;
  itinerary: number;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  user: ReviewAuthor;
}

export interface Itinerary {
  [key: string]: unknown;
  id: number | string;
  title: string;
  name?: string;
  slug?: string;
  destination_name?: string | null;
  destination?: Destination | number | string | null;
  city?: string | null;
  country?: string | null;
  summary?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_total?: number | string | null;
  currency_code?: string | null;
  generation_status?: "draft" | "generating" | "ready" | "failed" | string | null;
  review_stats?: ReviewStats | null;
  /** Presente no detalhe: o usuário logado é o dono do roteiro. */
  is_owner?: boolean;
  days?: ItineraryDay[] | null;
  generation_context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  cost?: number | string | null;
  cost_from?: number | string | null;
  rating?: number | string | null;
  duration_days?: number | string | null;
  duration?: number | string | null;
  tags?: TravelTag[] | string | null;
  pois?: string[] | null;
  points_of_interest?: string[] | null;
}
