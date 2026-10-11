import { useSearchParams, Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useDestinations } from "@/hooks/useDestinations";
import { matchesDestinationQuery } from "@/lib/destination-language";
import { destinationCategories } from "@/lib/personalization";
import { DestinationCard } from "@/features/destinations/destination-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardSkeletons, Feedback } from "@/components/ui/feedback";

export default function DestinationsPage() {
  const { destinations, loading, error, refetch } = useDestinations();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("categoria") ?? "";
  const categories = [...new Set(destinations.flatMap(destinationCategories))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = destinations.filter(destination => matchesDestinationQuery(destination, query) && (!category || destinationCategories(destination).includes(category)));
  function update(key: string, value: string) {
    setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  }
  return <section className="page-content">
    <Breadcrumbs current="Destinos" />
    <section className="reference-panel space-y-6">
      <header className="page-header"><div className="space-y-3"><h1 className="page-title">Encontre seu próximo destino</h1><p className="text-muted-foreground">Pesquise cidades, países ou experiências e escolha para onde viajar.</p></div><Button asChild variant="outline"><Link to="/roteiros/criacao?auto=destino">Sugerir um destino</Link></Button></header>
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <label className="form-label">Buscar destinos<div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted-foreground" aria-hidden="true" /><Input type="search" className="pl-10" placeholder="Ex.: Lisboa, Tóquio, Japão, Natureza" value={query} onChange={event => update("q", event.target.value)} /></div></label>
        <label className="form-label">Experiência<select className="h-11 rounded-control border border-input bg-white px-3" value={category} onChange={event => update("categoria", event.target.value)}><option value="">Todas as experiências</option>{categories.map(tag => <option key={tag}>{tag}</option>)}</select></label>
      </div>
      <p className="text-sm text-muted-foreground">A busca aceita nomes em português ou inglês, com ou sem acentos.</p>
      {loading ? <CardSkeletons /> : error ? <Feedback kind="error" title="Destinos indisponíveis" description={error} onRetry={refetch} /> : visible.length ? <><p role="status" className="text-sm text-muted-foreground">{visible.length} {visible.length === 1 ? "destino encontrado" : "destinos encontrados"}</p><div className="travel-grid">{visible.map(destination => <DestinationCard key={destination.id} destination={destination} />)}</div></> : <Feedback title="Nenhum destino encontrado" description="Tente outro nome, país ou experiência."><Button variant="outline" onClick={() => setParams({})}>Limpar filtros</Button></Feedback>}
    </section>
  </section>;
}
