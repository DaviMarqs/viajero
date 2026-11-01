import { DestinationCard } from "@/features/destinations/destination-card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";
import { useItineraries } from "@/hooks/useItineraries";
import { useDestinations } from "@/hooks/useDestinations";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import {
  itineraryDestination,
  destinationAffinity,
  destinationRecommendationReason,
  rankDestinations,
} from "@/lib/personalization";
import ItineraryCard from "@/pages/roteiros/itinerary-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { CardSkeletons, Feedback } from "@/components/ui/feedback";

export default function Recommendations() {
  const { token } = useAuth();
  const dna = useTravelerDNAProfile(token);
  const destinations = useDestinations();
  const featured = useItineraries("featured");
  const mine = useItineraries();
  const ranked = featured.itineraries
    .filter(
      (trip) => {
        const destination = itineraryDestination(trip, destinations.destinations);
        return destination && destinationRecommendationReason(destination, dna.profile) &&
          !mine.itineraries.some((item) => String(item.id) === String(trip.id));
      },
    )
    .sort((a, b) => {
      const left = itineraryDestination(a, destinations.destinations);
      const right = itineraryDestination(b, destinations.destinations);
      return (
        (right ? destinationAffinity(right, dna.profile) : 0) -
        (left ? destinationAffinity(left, dna.profile) : 0)
      );
    });
  const matchedDestinations = rankDestinations(destinations.destinations, dna.profile)
    .filter(destination => destinationRecommendationReason(destination, dna.profile))
    .slice(0, 6);
  return (
    <section className="page-content">
      <Breadcrumbs current="Para você" />
      <section className="reference-panel space-y-8">
      <header className="page-header">
        <div className="space-y-3">
          <h1 className="page-title">Para você</h1>
          <p className="text-muted-foreground">
            {dna.loading || dna.error
              ? "Encontre destinos e roteiros que combinam com você."
              : dna.profile
              ? "Destinos e roteiros relacionados aos seus interesses e às categorias cadastradas em cada destino."
              : "Complete seu DNA de viajante para descobrir destinos com interesses em comum."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/perfil">Ver meu DNA</Link>
        </Button>
      </header>
      {dna.loading ? (
        <CardSkeletons />
      ) : dna.error ? (
        <Feedback kind="error" title="DNA indisponível" description={dna.error} onRetry={dna.refetch} />
      ) : !dna.profile ? (
        <Feedback title="Seu perfil ainda não está pronto" description="Preencha seu DNA de viajante para encontrar destinos que tenham interesses em comum com você."><Button asChild><Link to="/perfil">Completar meu DNA</Link></Button></Feedback>
      ) : featured.loading || mine.loading || destinations.loading ? (
        <CardSkeletons />
      ) : featured.error || mine.error || destinations.error ? (
        <Feedback
          kind="error"
          title="Recomendações indisponíveis"
          description={
            featured.error ||
            mine.error ||
            destinations.error ||
            ""
          }
          onRetry={() => {
            featured.refetch();
            mine.refetch();
            destinations.refetch();
          }}
        />
      ) : matchedDestinations.length || ranked.length ? (
        <div className="space-y-10">
          {matchedDestinations.length > 0 && <section className="space-y-4" aria-labelledby="matched-destinations-title">
            <div className="space-y-2"><h2 id="matched-destinations-title" className="section-title">Destinos com interesses em comum</h2><p className="text-sm text-muted-foreground">Cada card mostra a categoria do destino que corresponde ao seu DNA.</p></div>
            <div className="travel-grid">{matchedDestinations.map(destination => <DestinationCard key={destination.id} destination={destination} recommendationReason={destinationRecommendationReason(destination, dna.profile)} />)}</div>
          </section>}
          {ranked.length > 0 && <section className="space-y-4" aria-labelledby="matched-itineraries-title">
            <div className="space-y-2"><h2 id="matched-itineraries-title" className="section-title">Roteiros nesses destinos</h2><p className="text-sm text-muted-foreground">Roteiros da comunidade em destinos com afinidade verificada.</p></div>
            <div className="travel-grid">{ranked.map(trip => <ItineraryCard key={trip.id} itinerary={trip} destinations={destinations.destinations} recommendationReason={destinationRecommendationReason(itineraryDestination(trip, destinations.destinations)!, dna.profile)} />)}</div>
          </section>}
        </div>
      ) : (
        <Feedback
          title="Ainda não encontramos combinações verificáveis"
          description="Os destinos disponíveis ainda não têm categorias que correspondam aos seus interesses principais. Explore o catálogo ou atualize seu DNA."
        >
          <Button asChild>
            <Link to="/destinos">Explorar destinos</Link>
          </Button>
          <Button asChild variant="outline"><Link to="/perfil">Ver meu DNA</Link></Button>
        </Feedback>
      )}
      </section>
    </section>
  );
}
