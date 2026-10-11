import { matchesDestinationQuery } from "@/lib/destination-language";
import { TravelCollection } from "@/components/ui/travel-collection";
import { DestinationImage } from "@/features/destinations/destination-card";
import { useItineraries } from "@/hooks/useItineraries";
import ItineraryCard from "@/pages/roteiros/itinerary-card";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { useDestinations } from "@/hooks/useDestinations";
import { DestinationCard } from "@/features/destinations/destination-card";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardSkeletons, Feedback } from "@/components/ui/feedback";
import { useAuth } from "@/contexts/authContext";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import {
  destinationCategories,
  travelTagLabel,
  destinationAffinity,
  rankDestinations,
} from "@/lib/personalization";
import { useMoney } from "@/contexts/currencyContext";

export default function Explorer({
  recommendations = false,
}: {
  recommendations?: boolean;
}) {
  const { destinations, loading, error, refetch } = useDestinations();
  const { token } = useAuth();
  const dna = useTravelerDNAProfile(token);
  const topTrips = useItineraries("top-rated");
  const { convertedAmount } = useMoney();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("categoria") ?? "";
  const sort = params.get("ordem") ?? "default";
  function update(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }
  const categories = [
    ...new Set(destinations.flatMap(destinationCategories)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = destinations
    .filter((destination) => {
      return (
        matchesDestinationQuery(destination, query) &&
        (!category || destinationCategories(destination).includes(category))
      );
    })
    .sort((a, b) => {
      const left = destinationCardData(a);
      const right = destinationCardData(b);
      if (sort === "budget")
        return (
          (convertedAmount(left.budget, left.currency) ?? Infinity) -
          (convertedAmount(right.budget, right.currency) ?? Infinity)
        );
      if (sort === "duration")
        return (left.duration ?? Infinity) - (right.duration ?? Infinity);
      if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1);
      return 0;
    });
  const aligned = dna.profile
    ? rankDestinations(visible, dna.profile)
        .filter(
          (destination) => destinationAffinity(destination, dna.profile) > 0,
        )
        .slice(0, 2)
    : [];
  return <section className="page-content">
    <Breadcrumbs current={recommendations ? "Para você" : "Experiências"} />
    <section className="reference-panel space-y-6" aria-labelledby="dna-choices-title">
      <div className="page-header"><div className="space-y-2"><h1 id="dna-choices-title" className="page-title">Escolhas alinhadas ao seu perfil</h1><p className="text-sm text-muted-foreground">Destinos selecionados pelos interesses do seu DNA de viajante.</p></div><Button asChild variant="travel"><Link to="/roteiros/criacao?auto=destino"><Sparkles aria-hidden="true" />Sugerir destino</Link></Button></div>
      {loading || dna.loading ? <CardSkeletons /> : error || dna.error ? <Feedback kind="error" title="Destinos indisponíveis" description={error || dna.error || ""} onRetry={() => { refetch(); dna.refetch(); }} /> : visible.length ? <TravelCollection label="Destinos alinhados ao seu perfil">{(aligned.length ? aligned : rankDestinations(visible, dna.profile)).map(destination => <DestinationCard key={destination.id} destination={destination} />)}</TravelCollection> : <Feedback title="Nenhum destino encontrado" description="Tente outra busca ou remova os filtros." />}
    </section>
    <section className="reference-panel space-y-6">
      <div className="page-header"><div className="space-y-2"><h2 className="section-title">Explorar por categorias</h2><p className="text-sm text-muted-foreground">Encontre o destino perfeito para seu gosto.</p></div><Button variant="travel" onClick={() => update("categoria", "")}>Ver todas</Button></div>
      <div className="category-grid">{categories.map(tag => {
        const destination = destinations.find(item => destinationCategories(item).includes(tag));
        const photoPoi = destination?.pois?.find(poi => poi.tags?.some(item => travelTagLabel(item.name) === tag) && typeof poi.metadata?.image_url === "string");
        const photo = typeof photoPoi?.metadata?.image_url === "string" ? photoPoi.metadata.image_url : destination ? destinationCardData(destination).image : undefined;
        return <button type="button" className="category-tile" key={tag} aria-pressed={category === tag} onClick={() => update("categoria", category === tag ? "" : tag)}><DestinationImage src={photo} name={tag} className="category-photo" /><span>{tag}</span></button>;
      })}</div>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <label className="form-label" htmlFor="explore-search">Buscar destinos<div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 size-5 text-muted-foreground" /><Input id="explore-search" type="search" placeholder="Cidade ou país" value={query} onChange={event => update("q", event.target.value)} className="pl-10" /></div></label>
        <label className="form-label" htmlFor="explore-sort">Ordenar por<select id="explore-sort" className="h-11 rounded-control border border-input bg-surface px-3" value={sort} onChange={event => update("ordem", event.target.value)}><option value="default">Seu perfil</option><option value="budget">Menor orçamento</option><option value="duration">Menor duração</option><option value="rating">Melhor avaliação</option></select></label>
      </div>
      {(query || category || sort !== "default") && <><p role="status" className="text-sm text-muted-foreground">{visible.length} destinos encontrados{category ? ` em ${category}` : ""}</p><div className="travel-grid">{visible.map(destination => <DestinationCard key={destination.id} destination={destination} />)}</div><Button variant="outline" onClick={() => setParams({})}>Limpar filtros</Button></>}
    </section>
    <section className="reference-panel space-y-6">
      <div className="page-header"><div className="space-y-2"><h2 className="section-title">{topTrips.itineraries.length ? "Roteiros com melhor avaliação" : "Destinos com melhor avaliação"}</h2><p className="text-sm text-muted-foreground">Explore as escolhas mais bem avaliadas.</p></div><Button asChild variant="travel"><Link to="/recomendações">Ver todos</Link></Button></div>
      {topTrips.loading || loading ? <CardSkeletons /> : topTrips.error ? <Feedback kind="error" title="Avaliações indisponíveis" description={topTrips.error} onRetry={topTrips.refetch} /> : topTrips.itineraries.length ? <TravelCollection label="Roteiros mais bem avaliados">{topTrips.itineraries.map(trip => <ItineraryCard key={trip.id} itinerary={trip} destinations={destinations} />)}</TravelCollection> : <TravelCollection label="Destinos mais bem avaliados">{[...destinations].sort((a,b) => Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0)).map(destination => <DestinationCard key={destination.id} destination={destination} />)}</TravelCollection>}
    </section>
  </section>;
}
