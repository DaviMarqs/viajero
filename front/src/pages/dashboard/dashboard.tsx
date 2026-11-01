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
import { DestinationCard, DestinationImage } from "@/features/destinations/destination-card";
import { HomeItineraryCard } from "@/components/ui/home-itinerary-card";
import { itineraryPresentation } from "@/features/itineraries/itinerary-presentation";
import { parseTripDate } from "@/lib/trip-dates";
import type { Itinerary } from "@/types/travel";
function upcomingTrip(trips: Itinerary[]) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = trips.flatMap(trip => {
    const date = parseTripDate(trip.start_date ?? "");
    return date && date.getTime() > today ? [{ trip, date, days: Math.round((date.getTime() - today) / 86400000) }] : [];
  }).sort((a, b) => a.days - b.days);
  return upcoming[0];
}




export function Dashboard() {
  const destinations = useDestinations();
  const trips = useItineraries();
  const featured = useItineraries("featured");
  const { token } = useAuth();
  const dna = useTravelerDNAProfile(token);
  const recommended = dna.profile ? featured.itineraries
    .filter((trip) => !trips.itineraries.some((mine) => String(mine.id) === String(trip.id)))
    .flatMap((trip) => {
      const destination = itineraryDestination(trip, destinations.destinations);
      const reason = destination && destinationRecommendationReason(destination, dna.profile);
      return destination && reason ? [{ trip, destination, reason }] : [];
    })
    .sort((a, b) => destinationAffinity(b.destination, dna.profile) - destinationAffinity(a.destination, dna.profile)) : [];
  const upcoming = upcomingTrip(trips.itineraries);
  const nextTripVisual = upcoming ? itineraryPresentation(upcoming.trip, destinations.destinations) : null;
  const homeTrips = upcoming ? [upcoming.trip, ...trips.itineraries.filter(trip => String(trip.id) !== String(upcoming.trip.id))] : trips.itineraries;
  const ranked = rankDestinations(destinations.destinations, dna.profile);
  const homeDestinations = dna.profile
    ? ranked.filter((destination) => destinationRecommendationReason(destination, dna.profile)).slice(0, 6)
    : ranked.slice(0, 6);
  return (
    <section className="page-content home-page">
      <div className="home-overview">
        <HomeHero />
        <section className="home-next-trip" aria-labelledby="next-trip-title">
          {nextTripVisual && <DestinationImage src={nextTripVisual.image} name={nextTripVisual.location} className="home-next-trip-image" />}
          <div className="home-next-trip-content">
            <div>
              <h2 id="next-trip-title" className="section-title">Próxima viagem</h2>
              {trips.loading ? <p role="status">Carregando sua viagem…</p>
                : trips.error ? <p>Não foi possível carregar seus roteiros.</p>
                : upcoming ? <>
                    <p className="home-next-trip-name">{upcoming.trip.title}</p>
                    <dl className="home-next-trip-details">
                      <div><dt>Destino</dt><dd>{nextTripVisual?.location || "Destino a definir"}</dd></div>
                      <div><dt>Partida</dt><dd>{upcoming.date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</dd></div>
                    </dl>
                    <p>Começa em {upcoming.days} {upcoming.days === 1 ? "dia" : "dias"}</p>
                  </>
                : <p>Você ainda não tem uma viagem com data marcada.</p>}
            </div>
            <Button asChild variant="outline" size="sm"><Link to={upcoming ? "/roteiros" : "/roteiros/criacao"}>
              {upcoming ? "Ver meus roteiros" : "Planejar uma viagem"}
            </Link></Button>
          </div>
        </section>
      </div>
      <dl className="home-metrics" aria-label="Resumo do Viajero">
        <div><dt>Seus roteiros</dt><dd>{trips.loading ? "…" : trips.error ? "—" : trips.itineraries.length}</dd></div>
        <div><dt>Destinos para explorar</dt><dd>{destinations.loading ? "…" : destinations.error ? "—" : destinations.destinations.length}</dd></div>
        <div><dt>Roteiros da comunidade</dt><dd>{featured.loading ? "…" : featured.error ? "—" : featured.itineraries.length}</dd></div>
      </dl>
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
            <Button asChild variant="ghost" size="sm"><Link to="/roteiros">Ver todos →</Link></Button>
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
            <div className="travel-grid" aria-label="Meus roteiros">
              {homeTrips.slice(0, 3).map((trip, index) => (
                <HomeItineraryCard
                  upcomingDays={index === 0 ? upcoming?.days : undefined}
                  key={trip.id}
                  itinerary={trip}
                  destinations={destinations.destinations}
                />
              ))}
            </div>
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
                  ? "Roteiros com afinidade identificada no seu DNA."
                  : "Complete seu DNA para encontrar roteiros que combinam com você."}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/recomendações">Ver todos →</Link></Button>
          </div>
          {dna.loading || (dna.profile && (featured.loading || destinations.loading)) ? (
            <CardSkeletons layout="home" label="Carregando recomendações" />
          ) : dna.error || (dna.profile && (featured.error || destinations.error)) ? (
            <Feedback
              kind="error"
              title="Recomendações indisponíveis"
              description={featured.error || destinations.error || dna.error || ""}
              onRetry={() => {
                featured.refetch();
                destinations.refetch();
                dna.refetch();
              }}
            />
          ) : !dna.profile ? (
            <Feedback
              title="Descubra seu jeito de viajar"
              description="Preencha seu DNA para receber sugestões com motivos claros."
            >
              <Button asChild variant="outline"><Link to="/perfil">Completar meu DNA</Link></Button>
            </Feedback>
          ) : recommended.length ? (
            <div className="travel-grid" aria-label="Roteiros recomendados">
              {recommended.slice(0, 1).map(({ trip, reason }) => (
                <div key={trip.id}>
                  <HomeItineraryCard itinerary={trip} destinations={destinations.destinations} />
                  <p className="home-recommendation-reason">{reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <Feedback
              title="Ainda não há roteiros compatíveis"
              description="Explore os destinos ou ajuste seu DNA para encontrar novas sugestões."
            >
              <Button asChild variant="outline">
                <Link to="/roteiros/criacao?auto=destino">
                  Gostaria de uma sugestão
                </Link>
              </Button>
            </Feedback>
          )}
        </section>
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
          <Button asChild variant="ghost" size="sm"><Link to="/destinos">Ver destinos</Link></Button>
        </div>
        {destinations.loading || dna.loading ? (
          <CardSkeletons layout="collection" />
        ) : destinations.error || dna.error ? (
          <Feedback
            kind="error"
            title="Destinos indisponíveis"
            description={destinations.error || dna.error || ""}
            onRetry={() => { destinations.refetch(); dna.refetch(); }}
          />
        ) : homeDestinations.length ? (
          <div className="travel-grid" aria-label={dna.profile ? "Destinos alinhados ao seu perfil" : "Destinos para explorar"}>
            {homeDestinations.map((destination) => (
              <DestinationCard compact key={destination.id} destination={destination} recommendationReason={destinationRecommendationReason(destination, dna.profile)} />
            ))}
          </div>
        ) : (
          <Feedback
            title={dna.profile ? "Ainda não há destinos compatíveis" : "Sua próxima descoberta está por vir"}
            description={dna.profile ? "Explore todos os destinos ou ajuste seu DNA para encontrar novas sugestões." : "Pesquise um destino para começar."}
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
