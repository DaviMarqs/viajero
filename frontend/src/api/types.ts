export type Destination = {
  id: number;
  name: string;
  country: string;
  city: string;
  summary: string;
  hero_image_url: string;
  average_rating: string;
  cost_profile?: {
    currency_code: string;
    daily_budget_low: string;
    daily_budget_mid: string;
    daily_budget_high: string;
  };
  pois?: PointOfInterest[];
};

export type PointOfInterest = {
  id: number;
  name: string;
  poi_type: string;
  summary: string;
  address: string;
  opening_hours: string;
};

export type ItineraryEvent = {
  id: number;
  title: string;
  description: string;
  estimated_cost: string;
};

export type ItineraryDay = {
  id: number;
  day_number: number;
  title: string;
  summary: string;
  estimated_cost: string;
  events: ItineraryEvent[];
};

export type Itinerary = {
  id: number;
  title: string;
  summary: string;
  duration_days: number;
  budget_total: string;
  currency_code: string;
  generation_status: string;
  destination: number;
  days: ItineraryDay[];
};

