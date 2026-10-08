import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Feedback, CardSkeletons } from '@/components/ui/feedback';
import { useItineraries } from '@/hooks/useItineraries';
import { useDestinations } from '@/hooks/useDestinations';
import ItineraryCard from './itinerary-card';

export default function Roteiros() {
  const { itineraries, loading, error, refetch } = useItineraries('mine');
  const { destinations } = useDestinations();
  return <section className="page-content">
    <Breadcrumbs current="Seus roteiros" />
    <header className="page-header pb-2">
      <div className="space-y-3">
        <h1 className="page-title">Seus roteiros</h1>
        <p className="text-muted-foreground">Retome seus planos e acompanhe cada etapa da viagem.</p>
      </div>
      <Button asChild size="lg"><Link to="/onboard/preferências"><Plus aria-hidden="true" />Criar novo roteiro</Link></Button>
    </header>
    {loading ? <CardSkeletons label="Carregando roteiros" /> : error ? <Feedback kind="error" title="Não conseguimos carregar seus roteiros" description={error} onRetry={refetch} /> : itineraries.length === 0 ? <Feedback title="Nenhum roteiro criado ainda" description="Conte suas preferências e planeje sua primeira viagem.">
      <Button asChild><Link to="/onboard/preferências">Criar roteiro</Link></Button>
    </Feedback> : <section className="space-y-5" aria-label="Roteiros salvos">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-base font-semibold">Suas viagens</h2>
        <p className="text-sm text-muted-foreground" role="status">{itineraries.length} {itineraries.length === 1 ? 'roteiro salvo' : 'roteiros salvos'}</p>
      </div>
      <div className="travel-grid">{itineraries.map(itinerary => <ItineraryCard key={itinerary.id} itinerary={itinerary} destinations={destinations} />)}</div>
    </section>}
  </section>;
}
