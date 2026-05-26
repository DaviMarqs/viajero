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

export async function fetchFeaturedItineraries() {
  const topRatedPayload = await apiFetch<ItinerariesPayload>("/api/itineraries/top-rated/");
  const topRated = unwrapListResponse(topRatedPayload);

  if (topRated.length > 0) {
    return topRated;
  }

  const templatesPayload = await apiFetch<ItinerariesPayload>("/api/itineraries/templates/");
  return unwrapListResponse(templatesPayload);
}
