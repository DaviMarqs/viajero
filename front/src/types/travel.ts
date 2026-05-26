export type TravelTag = string;

export interface LocationSummary {
  city?: string | null;
  country?: string | null;
}

export interface Destination {
  [key: string]: any;
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
  cost_profile?: string | null;
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
  pois?: Array<Record<string, any>> | null;
  points_of_interest?: Array<Record<string, any>> | null;
}

export interface Itinerary {
  [key: string]: any;
  id: number | string;
  title: string;
  name?: string;
  slug?: string;
  destination_name?: string | null;
  destination?: any;
  city?: string | null;
  country?: string | null;
  summary?: string | null;
  budget_total?: number | string | null;
  currency_code?: string | null;
  generation_status?: "draft" | "generating" | "ready" | "failed" | string | null;
  review_stats?: Record<string, any> | null;
  days?: Array<Record<string, any>> | null;
  metadata?: Record<string, any> | null;
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
