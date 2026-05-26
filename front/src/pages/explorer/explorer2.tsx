import { useMemo, useState } from "react";
import Filter from "@/components/ui/filter.updated";
import TripRecomendation, {
  type TripRecommendation,
} from "@/components/ui/trip-recomendation.updated";
import { useItineraries } from "@/hooks/useItineraries";
import type { Itinerary } from "@/types/travel";

function getDestinationName(itinerary: Itinerary) {
  if (typeof itinerary.destination === "string") return itinerary.destination;
  if (itinerary.destination?.name) return itinerary.destination.name;
  return itinerary.metadata?.destination_name || "Destino";
}

function getDestinationSlug(itinerary: Itinerary) {
  if (
    typeof itinerary.destination === "object" &&
    itinerary.destination?.slug
  ) {
    return itinerary.destination.slug;
  }

  return (
    itinerary.metadata?.destination_slug ||
    itinerary.slug ||
    String(itinerary.id)
  );
}

function getDestinationCountry(itinerary: Itinerary) {
  if (
    typeof itinerary.destination === "object" &&
    itinerary.destination?.country
  ) {
    return itinerary.destination.country;
  }

  return itinerary.metadata?.country || itinerary.country || "";
}

function getTripImage(itinerary: Itinerary) {
  if (itinerary.metadata?.hero_image_url)
    return itinerary.metadata.hero_image_url;
  if (itinerary.metadata?.image_url) return itinerary.metadata.image_url;

  if (
    typeof itinerary.destination === "object" &&
    itinerary.destination?.hero_image_url
  ) {
    return itinerary.destination.hero_image_url;
  }

  if (
    typeof itinerary.destination === "object" &&
    itinerary.destination?.image_url
  ) {
    return itinerary.destination.image_url;
  }

  return itinerary.image_url || itinerary.image || "";
}

function getTripRating(itinerary: Itinerary) {
  const reviewAverage = itinerary.review_stats?.average_rating;
  const destinationAverage =
    typeof itinerary.destination === "object"
      ? itinerary.destination?.average_rating
      : undefined;

  return Number(reviewAverage ?? destinationAverage ?? 0);
}

function getTripTags(itinerary: Itinerary) {
  if (Array.isArray(itinerary.metadata?.tags)) return itinerary.metadata.tags;
  if (Array.isArray(itinerary.tags)) return itinerary.tags;
  return [];
}

function getTripHighlights(itinerary: Itinerary) {
  if (Array.isArray(itinerary.metadata?.highlights))
    return itinerary.metadata.highlights;

  if (Array.isArray(itinerary.days)) {
    return itinerary.days
      .flatMap((day) => (Array.isArray(day?.pois) ? day.pois : []))
      .map((poi) => poi?.name)
      .filter(Boolean)
      .slice(0, 3);
  }

  return [];
}

function mapItineraryToTripRecommendation(
  itinerary: Itinerary,
): TripRecommendation {
  return {
    id: Number(itinerary.id),
    title: itinerary.title,
    destinationName: getDestinationName(itinerary),
    destinationSlug: getDestinationSlug(itinerary),
    country: getDestinationCountry(itinerary),
    summary: itinerary.summary || "",
    imageUrl: getTripImage(itinerary),
    durationDays: Number(itinerary.duration_days || 0),
    budgetTotal: Number(itinerary.budget_total || 0),
    currencyCode: itinerary.currency_code || "BRL",
    rating: getTripRating(itinerary),
    bestSeason:
      (typeof itinerary.destination === "object" &&
        itinerary.destination?.best_season) ||
      itinerary.metadata?.best_season ||
      "Ano todo",
    travelStyle: itinerary.metadata?.travel_style || "Roteiro",
    generationStatus:
      (itinerary.generation_status as TripRecommendation["generationStatus"]) ||
      "draft",
    tags: getTripTags(itinerary),
    highlights: getTripHighlights(itinerary),
  };
}

export default function Explorer() {
  const { itineraries, loading, error } = useItineraries();
  const [sortBy, setSortBy] = useState("recommended");

  const trips = useMemo(
    () => itineraries.map(mapItineraryToTripRecommendation),
    [itineraries],
  );

  // const readyTrips = trips.filter((trip) => trip.generationStatus === "ready");
  // const averageRating =
  //   trips.length > 0
  //     ? (
  //         trips.reduce(
  //           (total, trip) =>
  //             total + (Number.isFinite(trip.rating) ? trip.rating : 0),
  //           0,
  //         ) / trips.length
  //       ).toFixed(1)
  //     : "0.0";

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
                <p className="text-xs text-neutral-500">média</p>
              </div>
            </div> */}
          </div>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-medium text-neutral-950">
                Roteiros em destaque
              </h2>
              <p className="text-sm text-neutral-600">
                Sugestões carregadas da API para validar layout, filtros e
                navegação.
              </p>
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
