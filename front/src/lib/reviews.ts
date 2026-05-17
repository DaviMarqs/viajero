import { apiRequest } from './api'

export interface Review {
  id: number
  itinerary: number
  rating: number
  title: string
  body: string
  created_at: string
}

export interface CreateReviewInput {
  itinerary: number
  rating: number
  title: string
  body: string
}

export async function createReview(token: string, input: CreateReviewInput) {
  return apiRequest<Review>('/api/reviews/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
}