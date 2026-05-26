import { apiRequest } from "./api";

export interface TravelerDNAProfile {
  id: number;
  user: number;
  travel_style: string;
  pace: string;
  comfort_level: string;
  social_energy: number;
  adventure_level: number;
  food_focus: number;
  cultural_interest: number;
  nature_interest: number;
  nightlife_interest: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TravelerDNAUpsertInput {
  travel_style: string;
  pace: string;
  comfort_level: string;
  social_energy: number;
  adventure_level: number;
  food_focus: number;
  cultural_interest: number;
  nature_interest: number;
  nightlife_interest: number;
  notes: string;
}

export interface TripPreferenceMetadata {
  flexible_dates?: boolean;
  notes?: string;
  climate?: string[];
  destination_types?: string[];
  selected_experiences?: string[];
  additional_preferences?: string[];
  restrictions?: string;
}

export interface UserTripPreference {
  id: number;
  user: number;
  budget_min: string;
  budget_max: string;
  currency_code: string;
  preferred_trip_length_days: number;
  travel_month: string;
  hotel_level: string;
  transportation_style: string;
  dietary_preferences: string[];
  accessibility_needs: string[];
  interests: string[];
  metadata: TripPreferenceMetadata;
  created_at: string;
  updated_at: string;
}

export interface TripPreferenceUpsertInput {
  budget_min: number;
  budget_max: number;
  currency_code: string;
  preferred_trip_length_days: number;
  travel_month: string;
  hotel_level: string;
  transportation_style: string;
  dietary_preferences: string[];
  accessibility_needs: string[];
  interests: string[];
  metadata: TripPreferenceMetadata;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getTravelerDNAProfile(token: string) {
  return apiRequest<TravelerDNAProfile | null>("/api/traveler-dna", {
    headers: authHeaders(token),
  });
}

export async function saveTravelerDNAProfile(token: string, input: TravelerDNAUpsertInput) {
  return apiRequest<TravelerDNAProfile>("/api/traveler-dna", {
    method: "PATCH",
headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },    body: JSON.stringify(input),
  });
}

export async function getTripPreferences(token: string) {
  return apiRequest<UserTripPreference | null>("/api/trip-preferences", {
    headers: authHeaders(token),
  });
}

export async function saveTripPreferences(token: string, input: TripPreferenceUpsertInput) {
  return apiRequest<UserTripPreference>("/api/trip-preferences/me/", {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json", 
    },    body: JSON.stringify(input),
  });
}
