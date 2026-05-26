import { useEffect, useState } from "react";
import { fetchFeaturedItineraries, fetchItineraries } from "../lib/itineraries";
import type { Itinerary } from "../types/travel";
export type { ItineraryWithDestination } from "../lib/itineraries";

type ItineraryMode = "mine" | "featured";

export function useItineraries(mode: ItineraryMode = "mine") {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data =
          mode === "featured"
            ? await fetchFeaturedItineraries()
            : await fetchItineraries();
        if (active) {
          setItineraries(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os roteiros.");
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
    };
  }, [mode]);

  return { itineraries, loading, error };
}
