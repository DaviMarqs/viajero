import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { useItineraries } from "@/hooks/useItineraries";
import ItineraryCard from "./itinerary-card";
export default function Roteiros() {
  const navigate = useNavigate();
  const { itineraries, loading, error, refetch } = useItineraries("mine");
  return <section className="page-content">
    <Breadcrumbs current="Seus roteiros" />
    <header className="surface flex flex-wrap items-center justify-between gap-6">
      <div className="space-y-3">
        <h1 className="page-title">Seus roteiros</h1>
        <p className="text-muted-foreground">Retome seus planos e acompanhe cada etapa da viagem.</p>
      </div>
      <Button asChild>
        <Link to="/onboard/preferências">
          <Plus aria-hidden="true" />Criar novo roteiro</Link>
      </Button>
    </header>
    {loading ? <Feedback kind="loading" title="Carregando roteiros…" /> : error ? <Feedback kind="error" title="Não conseguimos carregar seus roteiros" description={error} onRetry={refetch} /> : itineraries.length === 0 ? <Feedback title="Nenhum roteiro criado ainda" description="Conte suas preferências e planeje sua primeira viagem.">
      <Button asChild>
        <Link to="/onboard/preferências">Criar roteiro</Link>
      </Button>
    </Feedback> : <div className="grid gap-6">
      <p className="text-sm text-muted-foreground" role="status">{itineraries.length} roteiro(s) encontrado(s)</p>{itineraries.map(itinerary => <ItineraryCard key={itinerary.id} itinerary={itinerary} onOpen={id => navigate('/roteiros/' + id)} />)}
    </div>}
  </section>;
}
