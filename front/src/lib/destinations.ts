import { apiRequest } from './api'

export interface Destination {
  id: number
  slug: string
  name: string
  country: string
  city: string
  summary: string
  hero_image_url: string
  timezone: string
  best_season: string
  average_rating: string
  cost_profile: string | null
  pois: unknown[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  created_by: number | null
}

export interface DestinationsResponse {
  count: number
  next: string | null
  previous: string | null
  results: Destination[]
}

export async function getDestinations(token: string) {
  return apiRequest<DestinationsResponse>('/api/destinations/', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getDestination(token: string, slug: string) {
  return apiRequest<Destination>(`/api/destinations/${slug}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}