import { useEffect, useState } from "react";

import { getPois, type Poi } from "@/lib/pois";

interface UsePoisReturn {
  pois: Poi[];
  loading: boolean;
  error: string | null;
}

export function usePois(
  token: string,
  destinationId: number | null,
): UsePoisReturn {
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(() => !!token && !!destinationId);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !destinationId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await getPois(token);
        const allPois = response.data.results;
        const filteredPois = allPois.filter((poi: Poi) => Number(poi.destination) === Number(destinationId));
        console.log("ALL POIS", allPois);
        console.log("FILTERED", filteredPois);
        if (!cancelled) {
          setPois(filteredPois);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro desconhecido");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, destinationId]);

  return {
    pois,
    loading,
    error,
  };
}
