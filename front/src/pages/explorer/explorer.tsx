import { Link, useSearchParams } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { useDestinations } from "@/hooks/useDestinations";
import { DestinationCard } from "@/features/destinations/destination-card";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardSkeletons, Feedback } from "@/components/ui/feedback";

export default function Explorer({ recommendations = false }: { recommendations?: boolean; }) {
  const { destinations, loading, error, refetch } = useDestinations();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("categoria") ?? "";
  const sort = params.get("ordem") ?? "default";
  function update(key: string, value: string) { setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true }); }
  const categories = [...new Set(destinations.flatMap(destination => destinationCardData(destination).tags))];
  const visible = destinations.filter(destination => {
    const card = destinationCardData(destination);
    return [card.name, card.country].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (!category || card.tags.includes(category));
  }).sort((a, b) => {
    const left = destinationCardData(a); const right = destinationCardData(b);
    if (sort === "budget") return (left.budget ?? Infinity) - (right.budget ?? Infinity);
    if (sort === "duration") return (left.duration ?? Infinity) - (right.duration ?? Infinity);
    if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1);
    return 0;
  });
  return <section className="page-content">
    <Breadcrumbs current={recommendations ? "Recomendações" : "Explorar"} />
    <section className="surface space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="page-title">{recommendations ? "Inspiração para sua próxima viagem" : "Explore seu próximo destino"}
          </h1>
          <p className="text-sm text-muted-foreground">Descubra destinos e encontre opções para o seu jeito de viajar.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/roteiros/criacao?auto=destino">
            <Sparkles aria-hidden="true" />Sugerir um destino</Link>
        </Button>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label htmlFor="explore-search" className="text-sm font-medium">Buscar destinos</label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-5 text-muted-foreground" />
            <Input id="explore-search" type="search" placeholder="Cidade ou país" value={query} onChange={e => update("q", e.target.value)} className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="explore-sort" className="block text-sm font-medium">Ordenar por</label>
          <select id="explore-sort" className="h-11 w-full rounded-control border border-input bg-surface px-3" value={sort} onChange={e => update("ordem", e.target.value)}>
            <option value="default">Ordem original</option>
            <option value="budget">Menor orçamento</option>
            <option value="duration">Menor duração</option>
            <option value="rating">Melhor avaliação</option>
          </select>
        </div>
      </div>
      {categories.length > 0 && <div className="space-y-3">
        <h2 className="text-lg">Explorar por categorias</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant={!category ? "default" : "outline"} aria-pressed={!category} onClick={() => update("categoria", "")}>Todas</Button>{categories.map(tag => <Button key={tag} variant={category === tag ? "default" : "outline"} aria-pressed={category === tag} onClick={() => update("categoria", tag)}>{tag}
          </Button>)}
        </div>
      </div>}
    </section>
    <section className="surface space-y-6" aria-label="Destinos disponíveis">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Destinos para descobrir</h2>
        <p className="text-sm text-muted-foreground" role="status">{!loading && !error && visible.length + " destino(s) encontrado(s)"}
        </p>
      </div>
      {loading ? <CardSkeletons /> : error ? <Feedback kind="error" title="Não conseguimos carregar os destinos" description={error} onRetry={refetch} /> : visible.length === 0 ? <Feedback title={destinations.length ? "Nenhum destino corresponde ? busca" : "Ainda não há destinos disponíveis"} description={destinations.length ? "Tente outro nome ou remova os filtros." : "Você pode pesquisar um destino para começar seu roteiro."}>{destinations.length ? <Button variant="outline" onClick={() => setParams({})}>Limpar filtros</Button> : <Button asChild>
        <Link to="/roteiros/criacao">Pesquisar destino</Link>
      </Button>}
      </Feedback> : <div className="grid gap-4 sm:grid-cols-2">{visible.map(destination => <DestinationCard key={destination.id} destination={destination} />)}
      </div>}
    </section>
  </section>;
}
