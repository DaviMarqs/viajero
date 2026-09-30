import { Link, useNavigate } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback, CardSkeletons } from "@/components/ui/feedback";
import { useDestinations } from "@/hooks/useDestinations";
import { useItineraries } from "@/hooks/useItineraries";
import { DestinationCard } from "@/features/destinations/destination-card";
import ItineraryCard from "@/pages/roteiros/itinerary-card";

export function Dashboard() {
  const destinations = useDestinations();
  const trips = useItineraries();
  const navigate = useNavigate();
  return <section className="page-content">
    <Breadcrumbs current="Painel principal" />
    <header className="hero-panel flex min-h-80 flex-col items-center justify-center gap-6 rounded-card px-6 py-14 text-center">
      <span className="badge">
        <Sparkles className="size-4" aria-hidden="true" />Impulsionado por IA</span>
      <div className="space-y-3">
        <h1 className="page-title sm:text-5xl">Sua próxima viagem começa aqui</h1>
        <p className="text-muted-foreground">Um painel para descobrir, planejar e retomar roteiros</p>
      </div>
      <Button size="lg" asChild>
        <Link to="/onboard/preferências">Criar novo roteiro<Plus aria-hidden="true" />
        </Link>
      </Button>
    </header>
    <div className="grid items-start gap-8 xl:grid-cols-2">
      <section className="surface space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Para o seu jeito de viajar</h2>
          <Link to="/explorar" className="text-sm text-primary hover:underline">Ver destinos</Link>
        </div>
        <p className="text-sm text-muted-foreground">Explore opções e encontre sua próxima parada.</p>{destinations.loading ? <CardSkeletons /> : destinations.error ? <Feedback kind="error" title="Destinos indisponíveis" description={destinations.error} onRetry={destinations.refetch} /> : destinations.destinations[0] ? <DestinationCard destination={destinations.destinations[0]} /> : <Feedback title="Sua próxima descoberta est? por vir" description="Pesquise um destino ou peça uma sugestão.">
          <Button variant="outline" asChild>
            <Link to="/roteiros/criacao">Descobrir destinos</Link>
          </Button>
        </Feedback>}
      </section>
      <section className="surface space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Seus roteiros</h2>
          <Link to="/roteiros" className="text-sm text-primary hover:underline">Ver todos</Link>
        </div>
        <p className="text-sm text-muted-foreground">Viagens salvas e rascunhos que você já começou</p>{trips.loading ? <Feedback kind="loading" title="Carregando roteiros…" /> : trips.error ? <Feedback kind="error" title="Roteiros indisponíveis" description={trips.error} onRetry={trips.refetch} /> : trips.itineraries[0] ? <ItineraryCard itinerary={trips.itineraries[0]} onOpen={id => navigate('/roteiros/' + id)} /> : <Feedback title="Nenhum roteiro salvo" description="Conte suas preferências para começar a planejar.">
          <Button asChild>
            <Link to="/onboard/preferências">Criar roteiro</Link>
          </Button>
        </Feedback>}
      </section>
    </div>
    {!destinations.loading && !destinations.error && destinations.destinations.length > 1 && <section className="surface space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="section-title">Mais lugares para conhecer</h2>
        <Link to="/explorar" className="text-sm text-primary hover:underline">Ver todos</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{destinations.destinations.slice(1, 3).map(destination => <DestinationCard key={destination.id} destination={destination} />)}
      </div>
    </section>}
  </section>;
}
