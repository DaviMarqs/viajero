import { useSearchParams, Link } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useDestinations } from "@/hooks/useDestinations";
import { filterDestinations } from "@/lib/destination-filters";
import { destinationCategories } from "@/lib/personalization";
import { DestinationCard } from "@/features/destinations/destination-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardSkeletons, Feedback } from "@/components/ui/feedback";
import { FilterChip } from "@/components/ui/filter-chip";
import { SelectField } from "@/components/ui/select-field";

const PAGE_SIZE = 12;

export default function DestinationsPage() {
  const { destinations, loading, error, refetch } = useDestinations();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const country = params.get("pais") ?? "";
  const order = params.get("ordem") === "za" ? "za" : "az";
  const selectedCategories = params.getAll("categoria");
  const categories = [...new Set(destinations.flatMap(destinationCategories))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const countries = [...new Set(destinations.map(destination => destination.country).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = filterDestinations(destinations, query, country, selectedCategories).sort((a, b) => order === "az" ? a.name.localeCompare(b.name, "pt-BR") : b.name.localeCompare(a.name, "pt-BR"));
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const requestedPage = Number(params.get("pagina") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const pageDestinations = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function update(key: string, value: string) {
    setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); if (key !== "pagina") next.delete("pagina"); return next; }, { replace: true });
  }
  function toggleCategory(value: string) {
    setParams(current => { const next = new URLSearchParams(current); const values = next.getAll("categoria"); next.delete("categoria"); next.delete("pagina"); (values.includes(value) ? values.filter(item => item !== value) : [...values, value]).forEach(item => next.append("categoria", item)); return next; }, { replace: true });
  }
  const activeFilters = [{ key: "q", label: query }, { key: "pais", label: country }].filter(filter => filter.label);
  return <section className="page-content">
    <Breadcrumbs current="Destinos" />
    <section className="reference-panel destination-catalog space-y-6">
      <header className="page-header"><div className="space-y-3"><h1 className="page-title">Encontre seu próximo destino</h1><p className="text-muted-foreground">Pesquise cidades e países. Combine experiências para encontrar uma viagem do seu jeito.</p></div><Button asChild><Link to="/roteiros/criacao?auto=destino">Sugerir um destino</Link></Button></header>
      <div className="destination-filters">
        <label className="form-label">Buscar destinos<div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted-foreground" aria-hidden="true" /><Input type="search" className="pl-10" placeholder="Ex.: Lisboa, Tóquio, Japão, Natureza" value={query} onChange={event => update("q", event.target.value)} /></div></label>
        <SelectField label="País" value={country} onChange={value => update("pais", value)} options={[{ value: "", label: "Todos os países" }, ...countries.map(value => ({ value, label: value }))]} />
        <div className="form-label"><span>Experiências</span><Popover.Root><Popover.Trigger asChild><button type="button" className="app-select-trigger" aria-label={`Experiências: ${selectedCategories.length ? `${selectedCategories.length} selecionadas` : "todas"}`} aria-haspopup="dialog"><span>{selectedCategories.length ? `${selectedCategories.length} selecionadas` : "Todas as experiências"}</span><span><ChevronDown className="size-4" aria-hidden="true" /></span></button></Popover.Trigger><Popover.Portal><Popover.Content align="start" sideOffset={4} className="app-select-content experience-popover" aria-label="Filtrar experiências"><fieldset className="app-select-viewport experience-options"><legend className="sr-only">Combinar experiências</legend>{categories.map(tag => <label key={tag} className="experience-option"><input type="checkbox" checked={selectedCategories.includes(tag)} onChange={() => toggleCategory(tag)} />{tag}</label>)}</fieldset><div className="experience-popover-footer"><Popover.Close asChild><Button variant="ghost" size="sm">Concluir</Button></Popover.Close></div></Popover.Content></Popover.Portal></Popover.Root></div>
        <SelectField label="Ordenar por" value={order} onChange={value => update("ordem", value)} options={[{ value: "az", label: "Nome: A a Z" }, { value: "za", label: "Nome: Z a A" }]} />
      </div>
      <p className="text-xs text-muted-foreground">Pesquise em português ou inglês, com ou sem acentos. Os resultados devem conter todas as experiências selecionadas.</p>
      {(activeFilters.length > 0 || selectedCategories.length > 0) && <div className="active-filter-row" aria-label="Filtros ativos"><span className="text-xs text-muted-foreground">Filtros ativos <span className="font-mono">({activeFilters.length + selectedCategories.length})</span></span>{activeFilters.map(filter => <FilterChip key={filter.key} selected aria-label={`Remover filtro ${filter.label}`} onClick={() => update(filter.key, "")}>{filter.label}<X className="size-4" aria-hidden="true" /></FilterChip>)}{selectedCategories.map(tag => <FilterChip key={tag} selected aria-label={`Remover filtro ${tag}`} onClick={() => toggleCategory(tag)}>{tag}<X className="size-4" aria-hidden="true" /></FilterChip>)}<Button variant="ghost" size="sm" onClick={() => setParams({})}>Limpar tudo</Button></div>}
      {loading ? <CardSkeletons /> : error ? <Feedback kind="error" title="Destinos indisponíveis" description={error} onRetry={refetch} /> : visible.length ? <><div className="destination-results"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} de {visible.length} {visible.length === 1 ? "destino" : "destinos"}</p><span className="text-sm text-muted-foreground">Página {page} de {pageCount}</span></div><div className="travel-grid">{pageDestinations.map(destination => <DestinationCard key={destination.id} destination={destination} />)}</div>{pageCount > 1 && <nav className="destination-pagination" aria-label="Páginas de destinos"><Button variant="outline" disabled={page === 1} onClick={() => update("pagina", String(page - 1))}>Anterior</Button><span aria-current="page">{page} / {pageCount}</span><Button variant="outline" disabled={page === pageCount} onClick={() => update("pagina", String(page + 1))}>Próxima</Button></nav>}</> : destinations.length ? <Feedback title="Nenhum destino com essa combinação" description="Os filtros selecionados não encontraram um destino em comum. Remova um filtro ou limpe a busca."><Button variant="outline" onClick={() => setParams({})}>Limpar filtros</Button>{destinations.slice(0, 3).map(destination => <Button key={destination.id} variant="ghost" onClick={() => setParams({ q: destination.name })}>Buscar {destination.name}</Button>)}</Feedback> : <Feedback title="Ainda não há destinos cadastrados" description="Novos destinos aparecerão aqui quando estiverem disponíveis." />}
    </section>
  </section>;
}
