import { TravelCollection } from "@/components/ui/travel-collection";
import { HomeHero } from "@/components/ui/home-hero";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Feedback, CardSkeletons } from "@/components/ui/feedback";
import { useDestinations } from "@/hooks/useDestinations";
import { useItineraries } from "@/hooks/useItineraries";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import { useAuth } from "@/contexts/authContext";
import {
  rankDestinations,
  destinationAffinity,
  itineraryDestination,
  destinationRecommendationReason,
} from "@/lib/personalization";
import { DestinationCard } from "@/features/destinations/destination-card";
import { HomeItineraryCard } from "@/components/ui/home-itinerary-card";
import { parseTripDate } from "@/lib/trip-dates";
import type { Itinerary } from "@/types/travel";
function upcomingTrip(trips: Itinerary[]) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = trips.flatMap(trip => {
    const date = parseTripDate(trip.start_date ?? "");
    return date && date.getTime() > today ? [{ trip, days: Math.round((date.getTime() - today) / 86400000) }] : [];
  }).sort((a, b) => a.days - b.days);
  return upcoming[0];
}




export function Dashboard() {
  const destinations = useDestinations();
  const trips = useItineraries();
  const featured = useItineraries("featured");
  const { token } = useAuth();
  const dna = useTravelerDNAProfile(token);
  const recommended = featured.itineraries
    .filter(
      (trip) =>
        !trips.itineraries.some((mine) => String(mine.id) === String(trip.id)),
    )
    .sort((a, b) => {
      const left = itineraryDestination(a, destinations.destinations);
      const right = itineraryDestination(b, destinations.destinations);
      return (
        (right ? destinationAffinity(right, dna.profile) : 0) -
        (left ? destinationAffinity(left, dna.profile) : 0)
      );
    });
  const upcoming = upcomingTrip(trips.itineraries);
  const homeTrips = upcoming ? [upcoming.trip, ...trips.itineraries.filter(trip => String(trip.id) !== String(upcoming.trip.id))] : trips.itineraries;
  const ranked = rankDestinations(destinations.destinations, dna.profile);
  return (
    <section className="page-content home-page">
      <HomeHero />
      <div className="home-itineraries">
        <section
          className="collection-panel space-y-6"
          aria-labelledby="my-trips-title"
        >
          <div className="page-header">
            <div className="space-y-2">
              <h2 id="my-trips-title" className="section-title">
                Meus roteiros
              </h2>
            </div>
            <Link
              className="section-link"
              to="/roteiros"
            >
              Ver todos →
            </Link>
          </div>
          {trips.loading ? (
            <CardSkeletons layout="home" label="Carregando roteiros" />
          ) : trips.error ? (
            <Feedback
              kind="error"
              title="Roteiros indisponíveis"
              description={trips.error}
              onRetry={trips.refetch}
            />
          ) : trips.itineraries.length ? (
            <TravelCollection label="Meus roteiros" home>
              {homeTrips.slice(0, 6).map((trip, index) => (
                <HomeItineraryCard
                  upcomingDays={index === 0 ? upcoming?.days : undefined}
                  key={trip.id}
                  itinerary={trip}
                  destinations={destinations.destinations}
                />
              ))}
            </TravelCollection>
          ) : (
            <Feedback
              className="itineraries-empty"
              title="Você ainda não tem roteiros"
              description="Escolha um destino e crie seu primeiro roteiro. Suas viagens planejadas aparecerão aqui."
            >
              <Button asChild>
                <Link to="/roteiros/criacao">Criar meu primeiro roteiro</Link>
              </Button>
            </Feedback>
          )}
        </section>
        {(featured.loading || dna.loading || destinations.loading || featured.error || dna.error || recommended.length > 0 || ranked.length === 0) && (
        <section
          className="collection-panel space-y-6"
          aria-labelledby="recommended-trips-title"
        >
          <div className="page-header">
            <div className="space-y-2">
              <h2 id="recommended-trips-title" className="section-title">
                Para o seu jeito de viajar
              </h2>
              <p className="text-sm text-muted-foreground">
                {dna.profile
                  ? "Inspirações ordenadas pelos interesses do seu DNA."
                  : "Inspirações da comunidade para sua próxima viagem."}
              </p>
            </div>
            <Link
              className="section-link"
              to="/recomendações"
            >
              Ver todos →
            </Link>
          </div>
          {featured.loading || dna.loading || destinations.loading ? (
            <CardSkeletons layout="home" label="Carregando recomendações" />
          ) : featured.error || dna.error ? (
            <Feedback
              kind="error"
              title="Recomendações indisponíveis"
              description={featured.error || dna.error || ""}
              onRetry={() => {
                featured.refetch();
                dna.refetch();
              }}
            />
          ) : recommended.length ? (
            <TravelCollection label="Roteiros recomendados" home>
              {recommended.slice(0, 6).map((trip) => (
                <HomeItineraryCard
                  key={trip.id}
                  itinerary={trip}
                  destinations={destinations.destinations}
                />
              ))}
            </TravelCollection>
          ) : (
            <Feedback
              title="Vamos criar um roteiro do seu jeito?"
              description="Ainda não há roteiros de outros viajantes disponíveis. Descubra um destino com base no seu perfil."
            >
              <Button asChild variant="outline">
                <Link to="/roteiros/criacao?auto=destino">
                  Gostaria de uma sugestão
                </Link>
              </Button>
            </Feedback>
          )}
        </section>
        )}
      </div>
      <section className="reference-panel dna-choices-compact space-y-6" aria-labelledby="destinations-title">
        <div className="page-header">
          <div className="space-y-2">
            <h2 id="destinations-title" className="section-title">
              {dna.profile
                ? "Escolhas alinhadas ao seu DNA"
                : "Destinos para sua próxima viagem"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {dna.profile
                ? "Explore lugares que combinam com seus interesses."
                : "Complete seu DNA no perfil para personalizar as recomendações."}
            </p>
          </div>
          <Link className="section-link" to="/destinos">Ver destinos</Link>
        </div>
        {destinations.loading ? (
          <CardSkeletons layout="collection" />
        ) : destinations.error ? (
          <Feedback
            kind="error"
            title="Destinos indisponíveis"
            description={destinations.error}
            onRetry={destinations.refetch}
          />
        ) : ranked.length ? (
          <TravelCollection label="Escolhas alinhadas ao seu perfil" completeCards>
            {ranked.slice(0, 6).map((destination) => (
              <DestinationCard compact key={destination.id} destination={destination} recommendationReason={destinationRecommendationReason(destination, dna.profile)} />
            ))}
          </TravelCollection>
        ) : (
          <Feedback
            title="Sua próxima descoberta está por vir"
            description="Pesquise um destino para começar."
          >
            <Button asChild variant="outline">
              <Link to="/roteiros/criacao">Descobrir destinos</Link>
            </Button>
          </Feedback>
        )}
      </section>
    </section>
  );
}
