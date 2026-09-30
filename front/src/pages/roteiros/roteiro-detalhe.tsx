import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CalendarDays, Coins, Loader2, MapPinned } from "lucide-react";
import { useParams } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import type { Itinerary } from "@/types/travel";

type ItineraryResponse = ApiSuccessResponse<Itinerary>;

function formatGenerationStatus(status?: string | null) {
  if (!status) return "Não informado";

  const labels: Record<string, string> = {
    draft: "Rascunho",
    generating: "Gerando",
    ready: "Pronto",
    failed: "Falhou",
  };

  return labels[status] || status;
}

function formatMoney(value?: string | number | null, currencyCode?: string | null) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return `${value} ${currencyCode ?? ""}`.trim();
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode || "BRL",
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export default function RoteiroDetalhePage() {
  const { id } = useParams();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: number | undefined;
    async function load() {
      if (!id) return;
      try {
        const response = await apiRequest<ItineraryResponse>(`/api/itineraries/${id}/`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setItinerary(response.data ?? null);
        setError(null);
        if (response.data?.generation_status === "generating") timeout = window.setTimeout(load, 4000);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível carregar o roteiro.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [id, revision]);
  if (!id) return <Feedback title="Roteiro não informado" />;
  if (loading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="flex min-h-[40vh] items-center justify-center rounded-card border border-border bg-white">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Carregando roteiro...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error) return <section className="page-content">
    <Feedback kind="error" title="Não conseguimos carregar o roteiro" description={error} onRetry={() => { setLoading(true); setRevision(value => value + 1); }}>
      <Button asChild variant="outline">
        <Link to="/roteiros">Voltar aos roteiros</Link>
      </Button>
    </Feedback>
  </section>;

  if (!itinerary) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-card border border-border bg-background px-6 py-5 text-sm text-muted-foreground">
          Nenhum roteiro foi encontrado para esse identificador.
        </div>
      </section>
    );
  }

  const days = itinerary.days ?? [];
  const destinationLabel =
    typeof itinerary.destination === "object" && itinerary.destination
      ? itinerary.destination.name
      : itinerary.destination_name;

  return (
    <section className="min-h-screen bg-background px-6 py-8 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-card border border-border bg-white p-8 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Roteiro #{itinerary.id}
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {itinerary.title}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-strong">
                {itinerary.summary || "Resumo ainda não dispoNível para este roteiro."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-primary">
              Status: <strong>{formatGenerationStatus(itinerary.generation_status) || "desconhecido"}
              </strong>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-card border border-border bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-secondary p-3 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">Período</p>
            <p className="mt-1 font-semibold text-foreground">
              {formatDate(itinerary.start_date)} - {formatDate(itinerary.end_date)}
            </p>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-secondary p-3 text-primary">
              <MapPinned className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">Destino</p>
            <p className="mt-1 font-semibold text-foreground">
              {destinationLabel || "Não informado"}
            </p>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-secondary p-3 text-primary">
              <Coins className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">Orçamento</p>
            <p className="mt-1 font-semibold text-foreground">
              {formatMoney(itinerary.budget_total, itinerary.currency_code)}
            </p>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-secondary p-3 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">Duração</p>
            <p className="mt-1 font-semibold text-foreground">
              {itinerary.duration_days || 0} dias
            </p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-white p-6 shadow-card">
          <h2 className="text-2xl font-semibold text-foreground">Dias do roteiro</h2>

          {days.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
              Ainda não existem dias gerados para este roteiro.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {days.map((day) => {
                const events = day.events ?? [];

                return (
                  <article
                    key={day.id}
                    className="rounded-card border border-border bg-secondary/60 p-5"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                          Dia {day.day_number}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-foreground">
                          {day.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-strong">
                          {day.summary || "Sem resumo para este dia."}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border bg-white px-3 py-2 text-sm text-strong">
                        Custo estimado: {formatMoney(day.estimated_cost, itinerary.currency_code)}
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {events.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-white px-4 py-4 text-sm text-muted-foreground">
                          Nenhum evento foi adicionado neste dia.
                        </div>
                      ) : (
                        events.map((eventItem) => (
                          <div
                            key={eventItem.id}
                            className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <h4 className="text-base font-semibold text-foreground">
                                  {eventItem.title}
                                </h4>
                                <p className="mt-1 text-sm leading-6 text-strong">
                                  {eventItem.description || "Sem descricao para este evento."}
                                </p>
                              </div>

                              <div className="text-sm text-muted-foreground">
                                {eventItem.start_time || "--:--"} - {eventItem.end_time || "--:--"}
                              </div>
                            </div>

                            <div className="mt-3 text-sm text-muted-foreground">
                              Custo estimado: {formatMoney(eventItem.estimated_cost, itinerary.currency_code)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
