import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export interface Poi {
  [key: string]: any;
  id: number | string;
  name?: string;
  title?: string;
  description?: string;
}

type PoisResponse = {
  data?: Poi[];
  results?: Poi[];
  items?: Poi[];
};

export function usePois(token?: string) {
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPois = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = (await apiRequest<PoisResponse>("/api/pois/", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })) as PoisResponse;

      setPois(response.data ?? response.results ?? response.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os POIs.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPois();
  }, [loadPois]);

  return { pois, loading, error, refetch: loadPois };
}
