import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback, CardSkeletons } from "@/components/ui/feedback";
import { useLocalFavorites } from "@/hooks/useLocalFavorites";
import { useDestinations } from "@/hooks/useDestinations";
import { DestinationCard } from "@/features/destinations/destination-card";
import ItineraryCard from "@/pages/roteiros/itinerary-card";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { apiRequest, type ApiSuccessResponse } from "@/lib/api";
import type { Itinerary } from "@/types/travel";

export default function FavoritesPage() {
  const [tab, setTab] = useState<"destinations" | "itineraries">(
    "destinations",
  );
  const favorites = useLocalFavorites();
  const destinations = useDestinations();
  const load = useCallback(async (signal: AbortSignal) => {
    const response = await apiRequest<
      ApiSuccessResponse<{ id: number | string; itinerary: Itinerary }[]>
    >("/api/favorites/", { signal });
    return response.data ?? [];
  }, []);
  const trips = useAsyncResource(load, [] as { id: number | string; itinerary: Itinerary }[]);
  const saved = destinations.destinations.filter((destination) =>
    favorites.has(destination.id),
  );
  return (
    <section className="page-content">
      <Breadcrumbs current="Favoritos" />
      <header className="space-y-3">
        <h1 className="page-title">Suas próximas possibilidades</h1>
        <p className="text-muted-foreground">
          Destinos e roteiros que você quer guardar por perto.
        </p>
      </header>
      <div className="flex gap-2" role="group" aria-label="Tipo de favorito">
        <Button
          aria-pressed={tab === "destinations"}
          variant={tab === "destinations" ? "secondary" : "ghost"}
          onClick={() => setTab("destinations")}
        >
          Destinos ({saved.length})
        </Button>
        <Button
          aria-pressed={tab === "itineraries"}
          variant={tab === "itineraries" ? "secondary" : "ghost"}
          onClick={() => setTab("itineraries")}
        >
          Roteiros ({trips.data.length})
        </Button>
      </div>
      <section className="space-y-5">
        <h2 className="section-title">
          {tab === "destinations" ? "Destinos favoritos" : "Roteiros favoritos"}
        </h2>
        {tab === "destinations" ? (
          destinations.loading ? (
            <CardSkeletons />
          ) : destinations.error ? (
            <Feedback
              kind="error"
              title="Destinos indisponíveis"
              description={destinations.error}
              onRetry={destinations.refetch}
            />
          ) : saved.length ? (
            <div className="travel-grid">
              {saved.map((destination) => (
                <DestinationCard
                  key={destination.id}
                  destination={destination}
                />
              ))}
            </div>
          ) : (
            <Feedback
              title="Guarde os destinos que você quer conhecer"
              description="Abra um destino e toque em Favoritar para encontrá-lo aqui."
            >
              <Button asChild>
                <Link to="/explorar">Explorar destinos</Link>
              </Button>
            </Feedback>
          )
        ) : trips.loading ? (
          <CardSkeletons />
        ) : trips.error ? (
          <Feedback
            kind="error"
            title="Roteiros indisponíveis"
            description={trips.error}
            onRetry={trips.refetch}
          />
        ) : trips.data.length ? (
          <div className="travel-grid">
            {trips.data.map((favorite) => (
              <ItineraryCard
                key={favorite.id}
                itinerary={favorite.itinerary}
                favoriteId={favorite.id}
                onRemoved={() => trips.setData(trips.data.filter((item) => item.id !== favorite.id))}
                destinations={destinations.destinations}
              />
            ))}
          </div>
        ) : (
          <Feedback
            title="Nenhum roteiro favorito ainda"
            description="Você pode salvar um roteiro na página de detalhes."
          >
            <Button asChild variant="outline">
              <Link to="/roteiros">Ver roteiros</Link>
            </Button>
          </Feedback>
        )}
        {tab === "destinations" && (
          <p className="text-xs text-muted-foreground">
            Seus destinos favoritos ficam salvos para esta conta neste
            navegador.
          </p>
        )}
      </section>
    </section>
  );
}
