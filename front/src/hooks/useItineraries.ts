import { useState, useEffect } from "react";
import { getItineraries, type Itinerary } from "@/lib/itineraries";
import { getDestinations, type Destination } from "@/lib/destinations";

export interface ItineraryWithDestination extends Itinerary {
  destinationData: Destination | null;
}

interface UseItinerariesReturn {
  itineraries: ItineraryWithDestination[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useItineraries(token: string): UseItinerariesReturn {
  const [itineraries, setItineraries] = useState<ItineraryWithDestination[]>(
    [],
  );
  const [loading, setLoading] = useState(() => !!token);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [itinerariesRes, destinationsRes] = await Promise.all([
          getItineraries(token),
          getDestinations(token),
        ]);

        const destinationMap = new Map(
          (destinationsRes.data.results ?? destinationsRes.data).map((d) => [
            d.id,
            d,
          ]),
        );

        const merged = itinerariesRes.data.results.map((it) => ({
          ...it,
          destinationData: destinationMap.get(it.destination) ?? null,
        }));

        if (!cancelled) setItineraries(merged);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, trigger]);

  const refetch = () => setTrigger((t) => t + 1);

  return { itineraries, loading, error, refetch };
}
