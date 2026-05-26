import { apiFetch, unwrapListResponse } from "./api";
import type { Destination } from "../types/travel";

type DestinationsPayload = Destination[] | { results?: Destination[]; data?: Destination[]; items?: Destination[] };

export type { Destination } from "../types/travel";

export async function fetchDestinations() {
  const payload = await apiFetch<DestinationsPayload>("/api/destinations/");
  return unwrapListResponse(payload);
}
