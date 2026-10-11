import { TravelCollection } from "@/components/ui/travel-collection";
import { HomeHero } from "@/components/ui/home-hero";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
import ItineraryCard from "@/pages/roteiros/itinerary-card";

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
  const ranked = rankDestinations(destinations.destinations, dna.profile);
  return (
    <section className="page-content">
      <Breadcrumbs current="Painel principal" />
      <HomeHero />
      <div className="home-itineraries">
        <section
          className="collection-panel space-y-5"
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
              className="text-sm font-medium text-primary hover:underline"
              to="/recomendações"
            >
              Ver todos
            </Link>
          </div>
          {featured.loading || dna.loading || destinations.loading ? (
            <CardSkeletons layout="collection" label="Carregando recomendações" />
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
            <TravelCollection label="Roteiros recomendados" single>
              {recommended.slice(0, 6).map((trip) => (
                <ItineraryCard
                  key={trip.id}
                  itinerary={trip}
                  destinations={destinations.destinations}
                  recommendationReason={destinationRecommendationReason(itineraryDestination(trip, destinations.destinations) ?? { id: "unknown", name: "" }, dna.profile)}
                />
              ))}
            </TravelCollection>
          ) : ranked.length ? (
            <TravelCollection label="Destinos para seu jeito de viajar" single>
              {ranked.slice(0, 6).map((destination) => <DestinationCard key={destination.id} destination={destination} recommendationReason={destinationRecommendationReason(destination, dna.profile)} />)}
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
        <section
          className="collection-panel space-y-5"
          aria-labelledby="my-trips-title"
        >
          <div className="page-header">
            <div className="space-y-2">
              <h2 id="my-trips-title" className="section-title">
                Meus roteiros
              </h2>
              <p className="text-sm text-muted-foreground">
                Retome os planos que você já começou.
              </p>
            </div>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              to="/roteiros"
            >
              Ver todos
            </Link>
          </div>
          {trips.loading ? (
            <CardSkeletons layout="collection" label="Carregando roteiros" />
          ) : trips.error ? (
            <Feedback
              kind="error"
              title="Roteiros indisponíveis"
              description={trips.error}
              onRetry={trips.refetch}
            />
          ) : trips.itineraries.length ? (
            <TravelCollection label="Meus roteiros" single>
              {trips.itineraries.slice(0, 6).map((trip) => (
                <ItineraryCard
                  key={trip.id}
                  itinerary={trip}
                  destinations={destinations.destinations}
                />
              ))}
            </TravelCollection>
          ) : (
            <Feedback
              title="Sua próxima viagem pode começar agora"
              description="Escolha um destino ou peça uma sugestão para criar seu primeiro roteiro."
            >
              <Button asChild>
                <Link to="/roteiros/criacao">Criar roteiro</Link>
              </Button>
            </Feedback>
          )}
        </section>
      </div>
      <section className="reference-panel dna-choices-compact space-y-5" aria-labelledby="destinations-title">
        <div className="page-header border-b border-border pb-4">
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
          <Button variant="travel" asChild>
            <Link to="/destinos">Explorar destinos</Link>
          </Button>
        </div>
        {destinations.loading ? (
          <CardSkeletons />
        ) : destinations.error ? (
          <Feedback
            kind="error"
            title="Destinos indisponíveis"
            description={destinations.error}
            onRetry={destinations.refetch}
          />
        ) : ranked.length ? (
          <TravelCollection label="Escolhas alinhadas ao seu perfil">
            {ranked.slice(0, 6).map((destination) => (
              <DestinationCard key={destination.id} destination={destination} recommendationReason={destinationRecommendationReason(destination, dna.profile)} />
            ))}
          </TravelCollection>
        ) : (
          <Feedback
            title="Sua próxima descoberta está por vir"
            description="Pesquise um destino para começar."
          >
            <Button asChild>
              <Link to="/roteiros/criacao">Descobrir destinos</Link>
            </Button>
          </Feedback>
        )}
      </section>
    </section>
  );
}
