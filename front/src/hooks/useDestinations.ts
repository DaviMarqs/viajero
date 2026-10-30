import { useEffect, useState } from "react";
import { fetchDestinations } from "../lib/destinations";
import type { Destination } from "../types/travel";

export function useDestinations() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchDestinations(controller.signal);
        if (active) {
          setDestinations(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os destinos.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  return { destinations, loading, error, refetch: () => setRevision(value => value + 1) };
}
