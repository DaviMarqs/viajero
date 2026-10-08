import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { DestinationImage } from '@/features/destinations/destination-card';
import { itineraryPresentation, itineraryStatus } from '@/features/itineraries/itinerary-presentation';
import { useDestinations } from '@/hooks/useDestinations';
import type { Itinerary } from "@/types/travel";

type ItineraryResponse = ApiSuccessResponse<Itinerary>;

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
  const { destinations } = useDestinations();
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
  const visual = itineraryPresentation(itinerary, destinations);
  return <section className="page-content">
    <Breadcrumbs current={itinerary.title} />
    <header className="page-header">
      <div className="space-y-3"><h1 className="page-title">{itinerary.title}</h1>
        <p className="text-muted-foreground">{[visual.location, visual.country].filter(Boolean).join(', ')}</p>
      </div>
      <span className="status-badge" data-status={itinerary.generation_status}>{itineraryStatus(itinerary.generation_status)}</span>
    </header>
    <DestinationImage src={visual.image} name={visual.location} className="h-48 rounded-card sm:h-60" />
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-border pb-7 lg:grid-cols-4">
      <div className="space-y-2"><dt className="text-sm text-muted-foreground">Período</dt><dd className="text-sm font-medium">{formatDate(itinerary.start_date)}<br />{formatDate(itinerary.end_date)}</dd></div>
      <div className="space-y-2"><dt className="text-sm text-muted-foreground">Destino</dt><dd className="text-sm font-medium">{visual.location}</dd></div>
      <div className="space-y-2"><dt className="text-sm text-muted-foreground">Orçamento</dt><dd className="text-sm font-medium tabular-nums">{formatMoney(itinerary.budget_total, itinerary.currency_code)}</dd></div>
      <div className="space-y-2"><dt className="text-sm text-muted-foreground">Duração</dt><dd className="text-sm font-medium">{itinerary.duration_days ? `${itinerary.duration_days} dias` : 'A definir'}</dd></div>
    </dl>
    {itinerary.summary && <p className="max-w-[70ch] text-sm leading-7 text-strong">{itinerary.summary}</p>}
    <section className="space-y-5" aria-label="Programação da viagem">
      <h2 className="section-title">Dias do roteiro</h2>
      {days.length === 0 ? <Feedback title="Ainda não existem dias gerados para este roteiro." description={itinerary.generation_status === 'generating' ? 'A programação aparecerá aqui quando a geração terminar.' : undefined} /> :
        <div className="divide-y divide-border rounded-card border border-border">
          {days.map((day, index) => <details key={day.id} open={index === 0} className="group/day px-5 sm:px-7">
            <summary className="flex min-h-20 cursor-pointer list-none flex-wrap items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-secondary font-medium text-primary" aria-label={`Dia ${day.day_number}`}>{day.day_number}</span>
                <span className="min-w-0"><span className="block font-display text-lg font-semibold">{day.title}</span><span className="text-xs text-muted-foreground">{day.events?.length ?? 0} atividades</span></span>
              </span>
              <span className="text-sm font-medium text-primary group-open/day:hidden">Ver atividades</span>
              <span className="hidden text-sm font-medium text-primary group-open/day:inline">Recolher</span>
            </summary>
            <div className="space-y-5 pb-7">
              {day.summary && <p className="max-w-[70ch] text-sm leading-6 text-strong">{day.summary}</p>}
              <p className="text-sm text-muted-foreground">Custo estimado do dia: <span className="font-medium text-foreground">{formatMoney(day.estimated_cost, itinerary.currency_code)}</span></p>
              {(day.events ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento foi adicionado neste dia.</p> :
                <ol className="divide-y divide-border border-t border-border">{day.events.map(event => <li key={event.id} className="grid gap-3 py-5 sm:grid-cols-[110px_1fr]">
                  <p className="text-sm font-medium tabular-nums text-primary">{event.start_time || '--:--'}<span className="text-muted-foreground"> - {event.end_time || '--:--'}</span></p>
                  <div className="space-y-2"><h4 className="text-base">{event.title}</h4><p className="max-w-[65ch] text-sm leading-6 text-strong">{event.description || 'Sem descrição para este evento.'}</p><p className="text-xs text-muted-foreground">Custo estimado: {formatMoney(event.estimated_cost, itinerary.currency_code)}</p></div>
                </li>)}</ol>}
            </div>
          </details>)}
        </div>}
    </section>
    <div><Button asChild variant="outline"><Link to="/roteiros">Voltar para seus roteiros</Link></Button></div>
  </section>;
}
