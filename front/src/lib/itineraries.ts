import { apiRequest } from './api'

export interface Itinerary {
  id: number
  title: string
  summary: string
  start_date: string
  end_date: string
  duration_days: number
  budget_total: string
  currency_code: string
  generation_status: string
  generation_context: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  user: number
  destination: number
  days: unknown[]
}

export interface ItinerariesResponse {
  count: number
  next: string | null
  previous: string | null
  results: Itinerary[]
}

export async function getItineraries(token: string) {
  return apiRequest<ItinerariesResponse>('/api/itineraries/', {
    headers: { Authorization: `Bearer ${token}` },
  })
}