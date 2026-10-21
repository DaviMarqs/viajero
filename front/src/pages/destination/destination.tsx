import { useToast } from "@/components/motion/toast-context";
import { Link, useParams } from "react-router-dom";
import { useDestinations } from "@/hooks/useDestinations";
import DestinationInfo from "@/components/ui/info";
import PoiList from "@/components/ui/poi-list";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/ui/tag-list";
import { DestinationGallery } from "@/components/ui/destination-gallery";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { useMoney } from "@/contexts/currencyContext";
import { useLocalFavorites } from "@/hooks/useLocalFavorites";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Heart, ArrowUpRight, Star } from "lucide-react";

export default function DestinationPage() {
  const { money, currency, convertedAmount } = useMoney();
  const favorites = useLocalFavorites();
  const notify = useToast();
  const latestFavorites = useRef(favorites);
  const mounted = useRef(true);
  useLayoutEffect(() => { latestFavorites.current = favorites; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [saveError, setSaveError] = useState("");
  const { id } = useParams();
  const { destinations, loading, error, refetch } = useDestinations();
  const destination = destinations.find(
    (item) => String(item.id) === id || item.slug === id,
  );
  const card = destination && destinationCardData(destination);
  return (
    <section className="page-content destination-detail">
      <Breadcrumbs current={destination?.name || "Detalhes do destino"} parent={{ label: "Destinos", to: "/destinos" }} />
      {loading ? (
        <div role="status" aria-busy="true" className="destination-loading">
          <span className="sr-only">Carregando destino…</span>
          <div className="h-8 w-1/3 skeleton-block" aria-hidden="true" />
          <div className="destination-gallery-main skeleton-block" aria-hidden="true" />
          <div className="h-24 skeleton-block" aria-hidden="true" />
        </div>
      ) : error ? (
        <Feedback kind="error" title="Não conseguimos carregar este destino" description={error} onRetry={refetch} />
      ) : !destination || !card ? (
        <Feedback title="Destino não encontrado" description="Volte à exploração para escolher outro destino.">
          <Button asChild variant="outline"><Link to="/explorar">Explorar destinos</Link></Button>
        </Feedback>
      ) : (
        <article className="destination-article">
          <header className="destination-heading">
            <h1 className="page-title">{destination.name}</h1>
            <div className="destination-meta">
              <p>{destination.country || "País não informado"}</p>
              {card.rating != null && <p className="inline-flex items-center gap-2 font-mono text-xs" aria-label={`Avaliação ${card.rating.toLocaleString("pt-BR")} de 5`}><Star className="size-4" aria-hidden="true" />{card.rating.toLocaleString("pt-BR")} / 5</p>}
              {card.tags.length > 0 && <TagList tags={card.tags} />}
            </div>
          </header>
          <DestinationGallery destination={destination} cover={card.image} />
          <div className="destination-columns">
            <div className="destination-content">
              <section className="space-y-4">
                <h2 className="section-title">Visão geral</h2>
                <p className="reading-copy text-strong">{destination.summary || destination.description || "Ainda não há uma descrição disponível para este destino."}</p>
              </section>
              <DestinationInfo destination={destination} />
              {!!destination.pois?.length && <PoiList pois={destination.pois} />}
              <Link className="section-link" to="/explorar">Voltar para explorar</Link>
            </div>
            <aside className="destination-aside" aria-label="Estimativas e planejamento">
              <div className="destination-planning">
                <h2 className="section-title">Planeje sua viagem</h2>
                <p className="text-xs text-muted-foreground">{destination.cost_profile && typeof destination.cost_profile === "object" ? "Estimativas por pessoa, por dia. Variam conforme a época e suas escolhas." : card.budgetLabel}</p>
                {destination.cost_profile && typeof destination.cost_profile === "object" ? (
                  <dl className="destination-price-bands">
                    {[
                      ["Econômico", "daily_budget_low"],
                      ["Intermediário", "daily_budget_mid"],
                      ["Mais conforto", "daily_budget_high"],
                    ].map(([label, key]) => <div className="destination-price-band" data-featured={key === "daily_budget_mid"} key={key}>
                      <dt>{label}</dt>
                      <dd>{money(destination.cost_profile && typeof destination.cost_profile === "object" && (typeof destination.cost_profile[key] === "string" || typeof destination.cost_profile[key] === "number") ? destination.cost_profile[key] as string | number : null, card.currency)}</dd>
                    </div>)}
                  </dl>
                ) : <p className="font-mono text-lg">{money(card.budget, card.currency)}</p>}
                <p className="text-xs leading-5 text-muted-foreground">{currency !== card.currency && convertedAmount(card.budget, card.currency) != null ? `Convertido de ${card.currency}, aproximado. Exibição em ${currency}.` : `Moeda de origem: ${card.currency}.${currency !== card.currency ? " Valores sem cotação permanecem na moeda original." : ""}`}</p>
                <div className="destination-cta">
                  <Button asChild><Link to="/roteiros/criacao" state={{ destination }}>Gerar roteiro<ArrowUpRight aria-hidden="true" /></Link></Button>
                  <Button variant="outline" aria-pressed={favorites.has(destination.id)} onClick={() => {
                    try {
                      const wasFavorite = favorites.has(destination.id);
                      favorites.toggle(destination.id);
                      notify({ title: wasFavorite ? "Destino removido dos favoritos neste navegador." : "Destino salvo nos favoritos neste navegador.", action: { label: "Desfazer", onClick: () => {
                        if (!mounted.current) return;
                        try { if (latestFavorites.current.has(destination.id) !== wasFavorite) latestFavorites.current.toggle(destination.id); }
                        catch { notify({ title: "Não foi possível desfazer. Verifique o armazenamento do navegador." }); }
                      } } });
                      setSaveError("");
                    } catch {
                      setSaveError("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
                    }
                  }}>
                    <Heart aria-hidden="true" className={favorites.has(destination.id) ? "favorite-heart fill-current" : "favorite-heart"} />
                    {favorites.has(destination.id) ? "Remover dos favoritos" : "Favoritar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Favoritos de destinos são salvos neste navegador.</p>
                {saveError && <p role="alert" className="text-sm">{saveError}</p>}
                {destination.cost_profile && typeof destination.cost_profile === "object" && typeof destination.cost_profile.notes === "string" && <div className="source-note"><p className="text-xs font-medium">Nota da fonte · moeda original ({card.currency})</p><p className="text-xs leading-5 text-muted-foreground">{destination.cost_profile.notes}</p></div>}
                {destination.cost_profile && typeof destination.cost_profile === "object" && typeof destination.cost_profile.source_url === "string" && destination.cost_profile.source_url.startsWith("https://") && <a className="section-link text-xs" href={destination.cost_profile.source_url} target="_blank" rel="noreferrer">Consultar fonte dos valores<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
              </div>
            </aside>
          </div>
        </article>
      )}
    </section>
  );
}
