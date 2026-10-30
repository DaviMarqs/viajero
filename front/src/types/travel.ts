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
}

export interface ItineraryDay {
  [key: string]: unknown;
  id: number | string;
  day_number: number;
  title: string;
  summary?: string | null;
  estimated_cost?: number | string | null;
  itinerary?: number | string | null;
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
