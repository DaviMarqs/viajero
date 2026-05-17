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
}

export interface DestinationsParams {
  page?: number
  search?: string
}

export async function getDestinations(token: string) {
  return apiRequest<Destination[]>(`/api/destinations/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getDestination(token: string, slug: string) {
  return apiRequest<Destination>(`/api/destinations/${slug}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}