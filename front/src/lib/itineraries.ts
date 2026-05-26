import { apiFetch, unwrapListResponse } from "./api";
import type { Itinerary } from "../types/travel";
import type { Destination } from "../types/travel";

type ItinerariesPayload = Itinerary[] | { results?: Itinerary[]; data?: Itinerary[]; items?: Itinerary[] };

export type ItineraryWithDestination = Itinerary & {
  [key: string]: any;
  destination?: Destination | string | null;
  destinationData?: Destination | null;
};

export async function fetchItineraries() {
  const payload = await apiFetch<ItinerariesPayload>("/api/itineraries/");
  return unwrapListResponse(payload);
}
