import { useSearchParams, Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useDestinations } from "@/hooks/useDestinations";
import { filterDestinations } from "@/lib/destination-filters";
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
  const country = params.get("pais") ?? "";
  const selectedCategories = params.getAll("categoria");
  const categories = [...new Set(destinations.flatMap(destinationCategories))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const countries = [...new Set(destinations.map(destination => destination.country).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = filterDestinations(destinations, query, country, selectedCategories);
  function update(key: string, value: string) {
    setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  }
  function toggleCategory(value: string) {
    setParams(current => { const next = new URLSearchParams(current); const values = next.getAll("categoria"); next.delete("categoria"); (values.includes(value) ? values.filter(item => item !== value) : [...values, value]).forEach(item => next.append("categoria", item)); return next; }, { replace: true });
  }
  const activeFilters = [{ key: "q", label: query }, { key: "pais", label: country }].filter(filter => filter.label);
  return <section className="page-content">
    <Breadcrumbs current="Destinos" />
    <section className="reference-panel space-y-6">
      <header className="page-header"><div className="space-y-3"><h1 className="page-title">Encontre seu próximo destino</h1><p className="text-muted-foreground">Pesquise cidades e países. Combine experiências para encontrar uma viagem do seu jeito.</p></div><Button asChild variant="outline"><Link to="/roteiros/criacao?auto=destino">Sugerir um destino</Link></Button></header>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_220px]">
        <label className="form-label">Buscar destinos<div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted-foreground" aria-hidden="true" /><Input type="search" className="pl-10" placeholder="Ex.: Lisboa, Tóquio, Japão, Natureza" value={query} onChange={event => update("q", event.target.value)} /></div></label>
        <label className="form-label">País<select className="h-11 rounded-control border border-input bg-white px-3" value={country} onChange={event => update("pais", event.target.value)}><option value="">Todos os países</option>{countries.map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="form-label"><span>Experiências</span><details className="filter-disclosure"><summary>{selectedCategories.length ? `${selectedCategories.length} selecionadas` : "Todas as experiências"}</summary><fieldset className="grid gap-3 p-3"><legend className="sr-only">Combinar experiências</legend>{categories.map(tag => <label key={tag} className="flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" checked={selectedCategories.includes(tag)} onChange={() => toggleCategory(tag)} />{tag}</label>)}</fieldset></details></div>
      </div>
      <p className="text-sm text-muted-foreground">Busca em português ou inglês, com ou sem acentos. Ao combinar experiências, os destinos devem ter todas as categorias escolhidas.</p>
      {(activeFilters.length > 0 || selectedCategories.length > 0) && <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">{activeFilters.map(filter => <Button key={filter.key} size="sm" variant="outline" aria-label={`Remover filtro ${filter.label}`} onClick={() => update(filter.key, "")}>{filter.label}<X size={14} aria-hidden="true" /></Button>)}{selectedCategories.map(tag => <Button key={tag} size="sm" variant="outline" aria-label={`Remover filtro ${tag}`} onClick={() => toggleCategory(tag)}>{tag}<X size={14} aria-hidden="true" /></Button>)}<Button variant="ghost" size="sm" onClick={() => setParams({})}>Limpar todos</Button></div>}
      {loading ? <CardSkeletons /> : error ? <Feedback kind="error" title="Destinos indisponíveis" description={error} onRetry={refetch} /> : visible.length ? <><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{visible.length} {visible.length === 1 ? "destino encontrado" : "destinos encontrados"}</p><div className="travel-grid">{visible.map(destination => <DestinationCard key={destination.id} destination={destination} />)}</div></> : <Feedback title="Nenhum destino com essa combinação" description="Remova um filtro ou explore uma das sugestões disponíveis."><Button variant="outline" onClick={() => setParams({})}>Limpar filtros</Button>{destinations.slice(0, 3).map(destination => <Button key={destination.id} variant="ghost" onClick={() => setParams({ q: destination.name })}>Buscar {destination.name}</Button>)}</Feedback>}
    </section>
  </section>;
}