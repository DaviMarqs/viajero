import { apiRequest } from "./api";

export interface Poi {
  id: number;
  destination: number;
  name: string;
  slug: string;
  poi_type: string;
  summary: string;
  address: string;
  opening_hours: string;
  source_url: string;
  price_level: number;
  rating: number;
  estimated_visit_minutes: number;
  metadata: Record<string, unknown>;
}

export interface PoisResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Poi[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

import type { ApiSuccessResponse } from "./api";

export async function getPois(token: string): Promise<ApiSuccessResponse<PoisResponse>> {
  return apiRequest<PoisResponse>(
    `/api/pois/`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}