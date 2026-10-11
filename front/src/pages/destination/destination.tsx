import { Link, useParams } from "react-router-dom";
import { useDestinations } from "@/hooks/useDestinations";
import DestinationInfo from "@/components/ui/info";
import PoiList from "@/components/ui/poi-list";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { DestinationGallery } from "@/components/ui/destination-gallery";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { useMoney } from "@/contexts/currencyContext";
import { useLocalFavorites } from "@/hooks/useLocalFavorites";
import { useState } from "react";
import { Heart } from "lucide-react";
import { destinationCategories } from "@/lib/personalization";
export default function DestinationPage() {
  const { money } = useMoney();
  const favorites = useLocalFavorites();
  const [saveError, setSaveError] = useState("");
  const { id } = useParams();
  const { destinations, loading, error, refetch } = useDestinations();
  const destination = destinations.find(
    (item) => String(item.id) === id || item.slug === id,
  );
  const card = destination && destinationCardData(destination);
  return (
    <section className="page-content">
      <Breadcrumbs current={destination?.name || "Detalhes do destino"} />
      {loading ? (
        <Feedback kind="loading" title="Carregando destino…" />
      ) : error ? (
        <Feedback
          kind="error"
          title="Não conseguimos carregar este destino"
          description={error}
          onRetry={refetch}
        />
      ) : !destination || !card ? (
        <Feedback
          title="Destino não encontrado"
          description="Volte à exploração para escolher outro destino."
        >
          <Button asChild variant="outline">
            <Link to="/explorar">Explorar destinos</Link>
          </Button>
        </Feedback>
      ) : (
        <article className="reference-panel space-y-8">
          <DestinationGallery destination={destination} cover={card.image} />
          <header className="page-header">
            <div className="space-y-3">
              <h1 className="page-title">{destination.name}</h1>
              <p className="text-muted-foreground">
                {[destination.city, destination.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {card.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span key={tag} className="badge">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                aria-pressed={favorites.has(destination.id)}
                onClick={() => {
                  try {
                    favorites.toggle(destination.id);
                    setSaveError("");
                  } catch {
                    setSaveError(
                      "Não foi possível salvar. Verifique se o navegador permite armazenamento local.",
                    );
                  }
                }}
              >
                <Heart
                  aria-hidden="true"
                  className={
                    favorites.has(destination.id)
                      ? "fill-current text-destructive"
                      : ""
                  }
                />
                {favorites.has(destination.id)
                  ? "Destino favorito"
                  : "Favoritar destino"}
              </Button>
              {saveError && (
                <p role="alert" className="max-w-sm text-sm text-destructive">
                  {saveError}
                </p>
              )}
            </div>
          </header>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-background p-6">
            <div>
              <p className="font-display text-2xl font-semibold">
                {money(card.budget, card.currency)}
              </p>
              <p className="text-sm text-muted-foreground">
                {card.budgetLabel}
              </p>
            </div>
            <Button
              asChild
              className="h-auto min-h-11 w-full whitespace-normal py-3 text-center sm:w-auto"
            >
              <Link to="/roteiros/criacao" state={{ destination }}>
                Gerar roteiro para este destino
              </Link>
            </Button>
          </div>
          <section className="space-y-3">
            <h2 className="section-title">Visão geral</h2>
            <p className="leading-relaxed text-strong">
              {destination.summary ||
                destination.description ||
                "Ainda não há uma descrição disponível para este destino."}
            </p>
          </section>
          <DestinationInfo destination={destination} />
          {destinationCategories(destination).length > 0 && (
            <section className="space-y-3">
              <h2 className="section-title">Experiências neste destino</h2>
              <div className="flex flex-wrap gap-2">
                {destinationCategories(destination).map((tag) => (
                  <Link
                    key={tag}
                    className="badge hover:bg-secondary hover:text-primary"
                    to={"/explorar?categoria=" + encodeURIComponent(tag)}
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </section>
          )}
          {destination.cost_profile &&
            typeof destination.cost_profile === "object" && (
              <section
                className="space-y-5"
                aria-labelledby="destination-costs"
              >
                <div className="space-y-2">
                  <h2 id="destination-costs" className="section-title">
                    Planeje seu orçamento
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Estimativas por pessoa, por dia. Os preços podem variar
                    conforme a época e suas escolhas.
                  </p>
                </div>
                <dl className="grid gap-5 sm:grid-cols-3">
                  {[
                    ["Econômico", "daily_budget_low"],
                    ["Intermediário", "daily_budget_mid"],
                    ["Mais conforto", "daily_budget_high"],
                  ].map(([label, key]) => (
                    <div
                      className="space-y-2 rounded-control bg-muted p-5"
                      key={key}
                    >
                      <dt className="text-sm text-strong">{label}</dt>
                      <dd className="font-display text-xl font-semibold">
                        {money(
                          destination.cost_profile &&
                            typeof destination.cost_profile === "object" &&
                            (typeof destination.cost_profile[key] ===
                              "string" ||
                              typeof destination.cost_profile[key] === "number")
                            ? (destination.cost_profile[key] as string | number)
                            : null,
                          card.currency,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {typeof destination.cost_profile.notes === "string" && (
                  <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">
                    {destination.cost_profile.notes}
                  </p>
                )}
                {typeof destination.cost_profile.source_url === "string" &&
                  destination.cost_profile.source_url.startsWith(
                    "https://",
                  ) && (
                    <a
                      className="text-sm text-primary underline"
                      href={destination.cost_profile.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Consultar fonte dos valores
                    </a>
                  )}
              </section>
            )}
          <PoiList pois={destination.pois ?? []} />
          <Button asChild variant="outline">
            <Link to="/explorar">Voltar para explorar</Link>
          </Button>
        </article>
      )}
    </section>
  );
}
