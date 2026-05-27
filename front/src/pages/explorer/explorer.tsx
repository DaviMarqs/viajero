import { useMemo, useState } from "react";
import Filter from "@/components/ui/filter.updated";
import TripRecomendation, {
  type TripRecommendation,
} from "@/components/ui/trip-recomendation.updated";
import { useDestinations } from "@/hooks/useDestinations";
import type { Destination } from "@/types/travel";

function getDestinationImage(destination: Destination) {
  return (
    destination.hero_image_url ||
    destination.image_url ||
    destination.image ||
    destination.cover_image ||
    ""
  );
}

function getDestinationBudget(destination: Destination) {
  const costProfile = destination.cost_profile;

  if (costProfile && typeof costProfile === "object") {
    const profile = costProfile as { daily_budget_mid?: unknown };
    const dailyBudgetMid = Number(profile.daily_budget_mid);
    if (Number.isFinite(dailyBudgetMid)) {
      return dailyBudgetMid;
    }
  }

  return Number(destination.cost_from || destination.cost || 0);
}

function getDestinationCurrency(destination: Destination) {
  const costProfile = destination.cost_profile;

  if (costProfile && typeof costProfile === "object") {
    const profile = costProfile as { currency_code?: unknown };
    if (typeof profile.currency_code === "string") {
      return profile.currency_code;
    }
  }

  return "BRL";
}

function getDestinationTags(destination: Destination) {
  if (Array.isArray(destination.metadata?.tags)) {
    return destination.metadata.tags.filter(
      (tag): tag is string => typeof tag === "string",
    );
  }

  if (Array.isArray(destination.tags)) {
    return destination.tags.filter(
      (tag): tag is string => typeof tag === "string",
    );
  }

  return [];
}

function getDestinationHighlights(destination: Destination) {
  if (Array.isArray(destination.metadata?.highlights)) {
    return destination.metadata.highlights.filter(
      (highlight): highlight is string => typeof highlight === "string",
    );
  }

  if (Array.isArray(destination.pois)) {
    return destination.pois
      .map((poi) => poi?.name)
      .filter((poi): poi is string => typeof poi === "string")
      .slice(0, 3);
  }

  return [];
}

function mapDestinationToTripRecommendation(
  destination: Destination,
): TripRecommendation {
  return {
    id: Number(destination.id),
    title: destination.name,
    destinationName: destination.name,
    destinationSlug: destination.slug || String(destination.id),
    country: destination.country || "",
    summary: destination.summary || "",
    imageUrl: getDestinationImage(destination),
    durationDays: Number(
      destination.duration_days || destination.duration || 3,
    ),
    budgetTotal: getDestinationBudget(destination),
    currencyCode: getDestinationCurrency(destination),
    rating: Number(destination.average_rating || destination.rating || 0),
    bestSeason: destination.best_season || "Ano todo",
    travelStyle: "Destino",
    generationStatus: "ready",
    tags: getDestinationTags(destination),
    highlights: getDestinationHighlights(destination),
  };
}

export default function Explorer() {
  const { destinations, loading, error } = useDestinations();
  const [sortBy, setSortBy] = useState("recommended");

  const trips = useMemo(
    () => destinations.map(mapDestinationToTripRecommendation),
    [destinations],
  );

  const readyTrips = trips.filter((trip) => trip.generationStatus === "ready");
  const averageRating =
    trips.length > 0
      ? (
          trips.reduce(
            (total, trip) =>
              total + (Number.isFinite(trip.rating) ? trip.rating : 0),
            0,
          ) / trips.length
        ).toFixed(1)
      : "0.0";

  const sortedTrips = useMemo(() => {
    const items = [...trips];

    if (sortBy === "budget") {
      items.sort((a, b) => a.budgetTotal - b.budgetTotal);
    } else if (sortBy === "duration") {
      items.sort((a, b) => a.durationDays - b.durationDays);
    } else if (sortBy === "rating") {
      items.sort((a, b) => b.rating - a.rating);
    }

    return items;
  }, [sortBy, trips]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:flex-row md:px-6 md:py-12">
        <aside className="w-full md:w-auto md:flex-shrink-0">
          <Filter />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 md:p-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-blue-600">
              Explorar roteiros
            </p>

            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-medium leading-tight text-neutral-950 md:text-5xl">
                  Encontre roteiros prontos para sua próxima viagem.
                </h1>

                <p className="mt-4 text-sm leading-6 text-neutral-600 md:text-base">
                  Veja exemplos de roteiros criados com base em destinos,
                  orçamento, duração e preferências de viagem. Use os filtros
                  para encontrar o roteiro ideal ou para se inspirar a criar o
                  seu próprio roteiro personalizado.
                </p>
              </div>
            </div>
            {/* <div className="grid grid-cols-3 gap-2 rounded-2xl bg-neutral-50 p-2 text-center">
               <div className="rounded-xl bg-white px-4 py-3">
                 <p className="text-xl font-medium text-neutral-950">
                   {trips.length}
                 </p>
                 <p className="text-xs text-neutral-500">roteiros</p>
               </div>

               <div className="rounded-xl bg-white px-4 py-3">
                 <p className="text-xl font-medium text-neutral-950">
                   {readyTrips.length}
                 </p>
                 <p className="text-xs text-neutral-500">prontos</p>
               </div>

               <div className="rounded-xl bg-white px-4 py-3">
                 <p className="text-xl font-medium text-neutral-950">
                   {averageRating}
                 </p>
                 <p className="text-xs text-neutral-500">mÃ©dia</p>
               </div>
             </div> */}
          </div>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-medium text-neutral-950">
                Roteiros em destaque
              </h2>
            </div>

            <select
              className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="recommended">Mais recomendados</option>
              <option value="budget">Menor orçamento</option>
              <option value="duration">Menor duração</option>
              <option value="rating">Melhor avaliação</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              Carregando roteiros...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              {error}
            </div>
          ) : sortedTrips.length === 0 ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              Nenhum roteiro encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {sortedTrips.map((trip) => (
                <TripRecomendation key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
