import { DestinationCard } from "@/features/destinations/destination-card";
import { rankDestinations } from "@/lib/personalization";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";
import { useItineraries } from "@/hooks/useItineraries";
import { useDestinations } from "@/hooks/useDestinations";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import {
  itineraryDestination,
  destinationAffinity,
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
      (trip) =>
        !mine.itineraries.some((item) => String(item.id) === String(trip.id)),
    )
    .sort((a, b) => {
      const left = itineraryDestination(a, destinations.destinations);
      const right = itineraryDestination(b, destinations.destinations);
      return (
        (right ? destinationAffinity(right, dna.profile) : 0) -
        (left ? destinationAffinity(left, dna.profile) : 0)
      );
    });
  return (
    <section className="page-content">
      <Breadcrumbs current="Recomendações" />
      <section className="reference-panel space-y-8">
      <header className="page-header">
        <div className="space-y-3">
          <h1 className="page-title">{ranked.length ? "Roteiros para o seu jeito de viajar" : "Destinos que combinam com sua viagem"}</h1>
          <p className="text-muted-foreground">
            {dna.profile
              ? "Inspirações ordenadas pelos interesses do seu DNA."
              : "Conheça roteiros da comunidade e complete seu DNA para personalizar as escolhas."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/roteiros/criacao?auto=destino">Sugerir um destino</Link>
        </Button>
      </header>
      {featured.loading ||
      mine.loading ||
      dna.loading ||
      destinations.loading ? (
        <CardSkeletons />
      ) : featured.error || mine.error || dna.error || destinations.error ? (
        <Feedback
          kind="error"
          title="Recomendações indisponíveis"
          description={
            featured.error ||
            mine.error ||
            dna.error ||
            destinations.error ||
            ""
          }
          onRetry={() => {
            featured.refetch();
            mine.refetch();
            dna.refetch();
            destinations.refetch();
          }}
        />
      ) : ranked.length ? (
        <div className="travel-grid">
          {ranked.map((trip) => (
            <ItineraryCard
              key={trip.id}
              itinerary={trip}
              destinations={destinations.destinations}
            />
          ))}
        </div>
      ) : destinations.destinations.length ? (
        <div className="travel-grid">{rankDestinations(destinations.destinations, dna.profile).slice(0, 6).map((destination) => <DestinationCard key={destination.id} destination={destination} />)}</div>
      ) : (
        <Feedback
          title="Seu próximo roteiro começa com uma descoberta"
          description="Ainda não há roteiros de outros viajantes disponíveis. Explore destinos ou peça uma sugestão para montar o seu."
        >
          <Button asChild>
            <Link to="/explorar">Explorar destinos</Link>
          </Button>
        </Feedback>
      )}
      </section>
    </section>
  );
}
