import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Feedback, CardSkeletons } from '@/components/ui/feedback';
import { useDestinations } from '@/hooks/useDestinations';
import { useItineraries } from '@/hooks/useItineraries';
import { DestinationCard } from '@/features/destinations/destination-card';
import ItineraryCard from '@/pages/roteiros/itinerary-card';

export function Dashboard() {
  const destinations = useDestinations();
  const trips = useItineraries();
  const topRated = useItineraries('top-rated');
  return <section className="page-content">
    <Breadcrumbs current="Painel principal" />
    <header className="page-header pb-2">
      <div className="space-y-3">
        <h1 className="page-title">Sua próxima viagem começa aqui</h1>
        <p className="text-muted-foreground">Um painel para descobrir, planejar e retomar roteiros.</p>
      </div>
      <Button size="lg" asChild><Link to="/onboard/preferências"><Plus aria-hidden="true" />Criar novo roteiro</Link></Button>
    </header>
    <section className="space-y-5">
      <div className="page-header border-b border-border pb-4">
        <div className="space-y-2"><h2 className="section-title">Seus roteiros</h2><p className="text-sm text-muted-foreground">Viagens salvas e rascunhos que você já começou.</p></div>
        <Button variant="travel" asChild><Link to="/roteiros">Ver todos os roteiros</Link></Button>
      </div>
      {trips.loading ? <CardSkeletons label="Carregando roteiros" /> : trips.error ? <Feedback kind="error" title="Roteiros indisponíveis" description={trips.error} onRetry={trips.refetch} /> : trips.itineraries.length ? <div className="travel-grid">
        {trips.itineraries.slice(0, 2).map(trip => <ItineraryCard key={trip.id} itinerary={trip} destinations={destinations.destinations} />)}
      </div> : <Feedback title="Nenhum roteiro salvo" description="Conte suas preferências para começar a planejar."><Button asChild><Link to="/onboard/preferências">Criar roteiro</Link></Button></Feedback>}
    </section>
    <section className="space-y-5" aria-labelledby="top-rated-title">
      <div className="page-header border-b border-border pb-4">
        <div className="space-y-2"><h2 id="top-rated-title" className="section-title">Roteiros mais bem avaliados</h2><p className="text-sm text-muted-foreground">Planos que outros viajantes aprovaram.</p></div>
      </div>
      {topRated.loading ? <CardSkeletons label="Carregando roteiros mais bem avaliados" /> : topRated.error ? <Feedback kind="error" title="Ranking indisponível" description={topRated.error} onRetry={topRated.refetch} /> : topRated.itineraries.length ? <div className="travel-grid">
        {topRated.itineraries.slice(0, 3).map(trip => <ItineraryCard key={trip.id} itinerary={trip} destinations={destinations.destinations} />)}
      </div> : <Feedback title="Nenhum roteiro avaliado ainda" description="Avalie seus roteiros prontos para inaugurar o ranking." />}
    </section>
    <section className="space-y-5">
      <div className="page-header border-b border-border pb-4">
        <div className="space-y-2"><h2 className="section-title">Para o seu jeito de viajar</h2><p className="text-sm text-muted-foreground">Explore opções e encontre sua próxima parada.</p></div>
        <Button variant="travel" asChild><Link to="/explorar">Ver destinos</Link></Button>
      </div>
      {destinations.loading ? <CardSkeletons /> : destinations.error ? <Feedback kind="error" title="Destinos indisponíveis" description={destinations.error} onRetry={destinations.refetch} /> : destinations.destinations.length ? <div className="travel-grid">
        {destinations.destinations.slice(0, 4).map(destination => <DestinationCard key={destination.id} destination={destination} />)}
      </div> : <Feedback title="Sua próxima descoberta está por vir" description="Pesquise um destino ou peça uma sugestão."><Button variant="outline" asChild><Link to="/roteiros/criacao">Descobrir destinos</Link></Button></Feedback>}
    </section>
  </section>;
}
