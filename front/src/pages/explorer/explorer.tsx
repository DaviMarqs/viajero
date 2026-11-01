import { matchesDestinationQuery } from "@/lib/destination-language";
import { TravelCollection } from "@/components/ui/travel-collection";
import { useItineraries } from "@/hooks/useItineraries";
import ItineraryCard from "@/pages/roteiros/itinerary-card";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Sparkles, Compass, Trees, Landmark, Utensils, ShoppingBag, Mountain, Moon, Waves, Leaf, Users, Palette, Crown, type LucideIcon } from "lucide-react";
import { useDestinations } from "@/hooks/useDestinations";
import { DestinationCard } from "@/features/destinations/destination-card";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { CardSkeletons, Feedback } from "@/components/ui/feedback";
import { useAuth } from "@/contexts/authContext";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import {
  destinationCategories,
  destinationAffinity,
  rankDestinations,
} from "@/lib/personalization";
import { useMoney } from "@/contexts/currencyContext";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  natureza: Trees, historia: Landmark, cultura: Palette, gastronomia: Utensils,
  compras: ShoppingBag, aventura: Mountain, "vida noturna": Moon,
  praia: Waves, relaxamento: Leaf, familia: Users, luxo: Crown,
};

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
  const query = params.get("q") ?? params.get("categoria") ?? "";
  const sort = params.get("ordem") ?? "default";
  function update(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("categoria");
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
      return matchesDestinationQuery({ ...destination, summary: [destination.summary, ...destinationCategories(destination)].join(" ") }, query);
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
  const ratedDestinations = destinations
    .filter((destination) => Number(destination.average_rating ?? 0) > 0)
    .sort((a, b) => Number(b.average_rating) - Number(a.average_rating));
  return <section className="page-content">
    <Breadcrumbs current={recommendations ? "Para você" : "Explorar"} />
    {recommendations && <section className="reference-panel space-y-6" aria-labelledby="dna-choices-title">
      <div className="page-header"><div className="space-y-2"><h1 id="dna-choices-title" className="page-title">Escolhas alinhadas ao seu perfil</h1><p className="text-sm text-muted-foreground">Destinos selecionados pelos interesses do seu DNA de viajante.</p></div><Button asChild variant="travel"><Link to="/roteiros/criacao?auto=destino"><Sparkles aria-hidden="true" />Sugerir destino</Link></Button></div>
      {!dna.loading && !dna.profile && <p className="text-sm text-muted-foreground">Seu DNA ainda não foi informado. Os destinos abaixo permitem explorar o catálogo disponível.</p>}
      {loading || dna.loading ? <CardSkeletons /> : error || dna.error ? <Feedback kind="error" title="Destinos indisponíveis" description={error || dna.error || ""} onRetry={() => { refetch(); dna.refetch(); }} /> : !query && sort === "default" ? visible.length ? <TravelCollection label="Destinos alinhados ao seu perfil">{(aligned.length ? aligned : rankDestinations(visible, dna.profile)).map(destination => <DestinationCard key={destination.id} destination={destination} compact />)}</TravelCollection> : <Feedback title="Nenhum destino encontrado" description="Tente outra busca ou remova os filtros." /> : null}
    </section>}
    {!recommendations && <section className="reference-panel space-y-6">
      <div className="page-header"><div className="space-y-2"><h1 className="page-title">Explorar</h1><p className="text-sm text-muted-foreground">Escolha um tema para começar ou busque livremente por destino.</p></div><Button asChild variant="outline"><Link to="/destinos">Todos os destinos</Link></Button></div>
      {loading ? <CardSkeletons /> : error ? <Feedback kind="error" title="Categorias indisponíveis" description={error} onRetry={refetch} /> : categories.length ? <div className="category-collection"><TravelCollection label="Temas para explorar">{categories.map(tag => {
        const Icon = CATEGORY_ICONS[tag.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()] ?? Compass;
        return <button type="button" className="category-tile" key={tag} onClick={() => update("q", tag)}><span className="category-icon"><Icon aria-hidden="true" /></span><span>{tag}</span></button>;
      })}</TravelCollection></div> : <Feedback title="Nenhuma categoria disponível" description="Ainda não há destinos para explorar." />}
      <div className="grid items-end gap-4 explore-filters">
        <label className="form-label" htmlFor="explore-search">Buscar destinos<div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 size-5 text-muted-foreground" /><Input id="explore-search" type="search" placeholder="Cidade, país ou tema" value={query} onChange={event => update("q", event.target.value)} className="pl-10" /></div></label>
        <SelectField label="Ordenar por" value={sort} onChange={value => update("ordem", value)} options={[{ value: "default", label: "Ordem padrão" }, { value: "budget", label: "Menor orçamento" }, { value: "duration", label: "Menor duração" }, { value: "rating", label: "Melhor avaliação" }]} />
      </div>
      {!loading && !error && (query || sort !== "default") && <><p role="status" className="text-sm text-muted-foreground">{visible.length} {visible.length === 1 ? "destino encontrado" : "destinos encontrados"}</p>{visible.length ? <div className="travel-grid">{visible.map(destination => <DestinationCard key={destination.id} destination={destination} />)}</div> : <Feedback title="Nenhum destino encontrado" description="Tente outra busca ou escolha outro tema." />}<Button variant="outline" onClick={() => setParams({})}>Limpar busca</Button></>}
    </section>}
    {!recommendations && (topTrips.loading || topTrips.error || topTrips.itineraries.length > 0 || ratedDestinations.length > 0) && <section className="reference-panel space-y-6">
      <div className="page-header"><div className="space-y-2"><h2 className="section-title">{topTrips.itineraries.length ? "Roteiros com melhor avaliação" : "Destinos com melhor avaliação"}</h2><p className="text-sm text-muted-foreground">Explore as escolhas mais bem avaliadas.</p></div><Button asChild variant="travel"><Link to={topTrips.itineraries.length ? "/recomendações" : "/destinos"}>Ver todos</Link></Button></div>
      {topTrips.loading || loading ? <CardSkeletons /> : topTrips.error ? <Feedback kind="error" title="Avaliações indisponíveis" description={topTrips.error} onRetry={topTrips.refetch} /> : topTrips.itineraries.length ? <TravelCollection label="Roteiros mais bem avaliados">{topTrips.itineraries.map(trip => <ItineraryCard key={trip.id} itinerary={trip} destinations={destinations} />)}</TravelCollection> : <TravelCollection label="Destinos mais bem avaliados">{ratedDestinations.map(destination => <DestinationCard key={destination.id} destination={destination} />)}</TravelCollection>}
    </section>}
  </section>;
}
