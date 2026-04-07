export interface Tokens {
  access: string
  refresh: string
}

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  preferred_language: string
  role: 'user' | 'admin' | 'superadmin'
  status: string
  onboarding_completed: boolean
}

export interface CurrentUserPayload {
  user: User
  profile: Record<string, string | null>
  dna: Record<string, string | null>
  preferences: Record<string, string | number | null>
  interests: { id: number; name: string }[]
}

export interface Destination {
  id: number
  name: string
  city: string
  country: string
  climate: string
  destination_type: string
  description: string
}

export interface ItineraryItem {
  id?: number
  category: string
  title: string
  description: string
  estimated_cost?: number
  sort_order: number
}

export interface ItineraryDay {
  id?: number
  day_number: number
  title: string
  summary: string
  items: ItineraryItem[]
}

export interface Itinerary {
  id: number
  destination: number
  template?: number | null
  title: string
  description: string
  origin: string
  budget_estimate: number
  is_public: boolean
  days: ItineraryDay[]
  created_at: string
}

export interface ApiListResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
