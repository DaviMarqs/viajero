import { useCallback } from "react";
import { apiRequest, unwrapListResponse } from "../lib/api";
import type { Poi } from "../lib/pois";
import { useAsyncResource } from "./useAsyncResource";
export type { Poi } from "../lib/pois";
export function usePois(token?: string) {
  const load = useCallback(async (signal: AbortSignal) => {
    const response = await apiRequest<{ data?: Poi[] | { results?: Poi[]; }; results?: Poi[]; }>("/api/pois/", { signal, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    return unwrapListResponse(response);
  }, [token]);
  const { data: pois, loading, error, refetch } = useAsyncResource<Poi[]>(load, []);
  return { pois, loading, error, refetch };
}
