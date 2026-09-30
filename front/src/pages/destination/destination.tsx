import { Link, useParams } from "react-router-dom";
import { useDestinations } from "@/hooks/useDestinations";
import DestinationInfo from "@/components/ui/info";
import PoiList from "@/components/ui/poi-list";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { DestinationImage } from "@/features/destinations/destination-card";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { formatCurrency } from "@/lib/utils";
export default function DestinationPage() {
  const { id } = useParams();
  const { destinations, loading, error, refetch } = useDestinations();
  const destination = destinations.find(item => String(item.id) === id || item.slug === id);
  const card = destination && destinationCardData(destination);
  return <section className="page-content">
    <Breadcrumbs current={destination?.name || "Detalhes do destino"} />
    {loading ? <Feedback kind="loading" title="Carregando destino…" /> : error ? <Feedback kind="error" title="Não conseguimos carregar este destino" description={error} onRetry={refetch} /> : !destination || !card ? <Feedback title="Destino não encontrado" description="Volte ? exploração para escolher outro destino.">
      <Button asChild variant="outline">
        <Link to="/explorar">Explorar destinos</Link>
      </Button>
    </Feedback> : <article className="surface space-y-8">
      <DestinationImage src={card.image} name={card.name} className="h-64 rounded-card sm:h-96 lg:h-[480px]" />
      <header className="space-y-3">
        <h1 className="page-title">{destination.name}
        </h1>
        <p className="text-muted-foreground">{[destination.city, destination.country].filter(Boolean).join(", ")}
        </p>{card.tags.length > 0 && <div className="flex flex-wrap gap-2">{card.tags.map(tag => <span key={tag} className="badge">{tag}
        </span>)}
        </div>}
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-background p-6">
        <div>
          <p className="font-display text-2xl font-semibold">{formatCurrency(card.budget, "pt-BR", card.currency)}
          </p>
          <p className="text-sm text-muted-foreground">{card.budgetLabel}
          </p>
        </div>
        <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-3 text-center sm:w-auto">
          <Link to="/roteiros/criacao" state={{ destination }}>Gerar roteiro para este destino</Link>
        </Button>
      </div>
      <section className="space-y-3">
        <h2 className="section-title">Visão geral</h2>
        <p className="leading-relaxed text-strong">{destination.summary || destination.description || "Ainda não há uma descrição disponível para este destino."}
        </p>
      </section>
      <DestinationInfo destination={destination} />
      <PoiList pois={destination.pois ?? []} />
      <Button asChild variant="outline">
        <Link to="/explorar">Voltar para explorar</Link>
      </Button>
    </article>}
  </section>;
}
