import { localizedDestination } from "./destination-language";
import { apiFetch, unwrapListResponse } from "./api";
import type { Destination } from "../types/travel";
import type { TripPreferenceUpsertInput } from "./profiles";

type DestinationsPayload = Destination[] | { results?: Destination[]; data?: Destination[]; items?: Destination[]; };

export type { Destination } from "../types/travel";

export async function fetchDestinations(signal?: AbortSignal) {
  const payload = await apiFetch<DestinationsPayload>("/api/destinations/", { signal });
  return unwrapListResponse(payload).map(localizedDestination);
}

export async function suggestDestination(preferences?: TripPreferenceUpsertInput, signal?: AbortSignal) {
  const payload = await apiFetch<{ data?: Destination; }>("/api/destinations/suggest/", {
    method: "POST", signal,
    ...(preferences ? { body: JSON.stringify({ trip_preferences: preferences }) } : {}),
  });
  return payload?.data ?? null;
}
