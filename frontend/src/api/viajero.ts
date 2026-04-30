import { apiRequest } from "./client";
import { Destination, Itinerary } from "./types";

export const viajeroApi = {
  destinations: () => apiRequest<{ results?: Destination[] } | Destination[]>("/destinations/"),
  destination: (id: string) => apiRequest<Destination>(`/destinations/${id}/`),
  createItinerary: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest<Itinerary>("/itineraries/", { method: "POST", body: payload, token }),
  generateItinerary: (id: string | number, token?: string | null) =>
    apiRequest<Itinerary>(`/itineraries/${id}/generate/`, { method: "POST", token }),
  itinerary: (id: string, token?: string | null) => apiRequest<Itinerary>(`/itineraries/${id}/`, { token }),
  favorites: (token?: string | null) => apiRequest("/favorites/", { token }),
  login: (payload: Record<string, unknown>) => apiRequest("/auth/login/", { method: "POST", body: payload }),
  register: (payload: Record<string, unknown>) => apiRequest("/auth/register/", { method: "POST", body: payload }),
  updateProfile: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/users/me/", { method: "PATCH", body: payload, token }),
  createTravelerDna: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/traveler-dna/", { method: "POST", body: payload, token }),
  createTripPreferences: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/trip-preferences/", { method: "POST", body: payload, token }),
  createFavorite: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/favorites/", { method: "POST", body: payload, token }),
  createReview: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/reviews/", { method: "POST", body: payload, token }),
  shareItinerary: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/shared-links/", { method: "POST", body: payload, token }),
  triggerFirecrawl: (payload: Record<string, unknown>, token?: string | null) =>
    apiRequest("/firecrawl/ingest/", { method: "POST", body: payload, token }),
};

