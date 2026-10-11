import { Feedback, PageSkeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useParams } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DestinationImage } from "@/features/destinations/destination-card";
import {
  itineraryPresentation,
  itineraryStatus,
} from "@/features/itineraries/itinerary-presentation";
import { useDestinations } from "@/hooks/useDestinations";
import { ReviewsSection } from "@/features/reviews/reviews-section";
import type { Itinerary } from "@/types/travel";
import { useAuth } from "@/contexts/authContext";
import { useMoney } from "@/contexts/currencyContext";
import { ItineraryEditor, DayEditor } from "@/features/itineraries/itinerary-editor";
import {
  localProgramKey,
  readLocalProgram,
  tripHasEnded,
} from "@/features/itineraries/itinerary-editing";
import { ItineraryActivity } from "@/features/itineraries/itinerary-activity";
import { FavoriteItineraryButton } from "@/features/itineraries/favorite-itinerary-button";

type ItineraryResponse = ApiSuccessResponse<Itinerary>;

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export default function RoteiroDetalhePage() {
  const { user } = useAuth();
  const { money } = useMoney();
  const { id } = useParams();
  const { destinations } = useDestinations();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draft, setDraft] = useState<Itinerary | null>(null);
  const [original, setOriginal] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: number | undefined;
    async function load() {
      if (!id) return;
      try {
        const response = await apiRequest<ItineraryResponse>(
          `/api/itineraries/${id}/`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setOriginal(response.data ?? null);
        setItinerary(
          response.data
            ? readLocalProgram(
                response.data,
                localProgramKey(user?.id, response.data.id),
              )
            : null,
        );
        setError(null);
        if (response.data?.generation_status === "generating")
          timeout = window.setTimeout(load, 4000);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar o roteiro.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [id, revision, user?.id]);
  if (!id) return <Feedback title="Roteiro não informado" />;
  if (loading) return <PageSkeleton />;

  if (error)
    return (
      <section className="page-content">
        <Feedback
          kind="error"
          title="Não conseguimos carregar o roteiro"
          description={error}
          onRetry={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          <Button asChild variant="outline">
            <Link to="/roteiros">Voltar aos roteiros</Link>
          </Button>
        </Feedback>
      </section>
    );

  if (!itinerary) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-card border border-border bg-background px-6 py-5 text-sm text-muted-foreground">
          Nenhum roteiro foi encontrado para esse identificador.
        </div>
      </section>
    );
  }

  const activeDraft = draft?.id === itinerary.id ? draft : null;
  const displayed = activeDraft ?? itinerary;
  const days = displayed.days ?? [];
  const visual = itineraryPresentation(itinerary, destinations);
  return (
    <section className="page-content itinerary-detail">
      <Breadcrumbs current={itinerary.title} />
      <header className="page-header">
        <div className="space-y-3">
          <h1 className="page-title">{itinerary.title}</h1>
          <p className="text-muted-foreground">
            {[visual.location, visual.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="action-bar">
          <span
            className="status-badge"
            data-status={itinerary.generation_status}
          >
            {itineraryStatus(itinerary.generation_status)}
          </span>
          {itinerary.is_owner &&
            itinerary.generation_status === "ready" &&
            original && (
              <ItineraryEditor
                key={String(itinerary.id)}
                itinerary={itinerary}
                original={original}
                draft={activeDraft}
                onDraftChange={setDraft}
                onSavingChange={setSavingEdit}
                onSaved={setItinerary}
              />
            )}
          <FavoriteItineraryButton itineraryId={itinerary.id} />
          {itinerary.generation_status === "ready" &&
            (!itinerary.is_owner || tripHasEnded(itinerary.end_date)) && (
              <Button asChild variant="ghost">
                <a href="#avaliacoes">
                  <Star aria-hidden="true" />
                  {itinerary.is_owner
                    ? "Avaliar minha viagem"
                    : "Avaliar roteiro"}
                </a>
              </Button>
            )}
        </div>
      </header>
      {activeDraft && <section className="reference-panel space-y-4" aria-label="Modo de edição">
        <div><h2 className="text-lg">Modo de edição ativado</h2><p className="mt-1 text-sm text-muted-foreground">Arraste pela alça para reordenar. Remova atividades antes de salvar. Os horários serão recalculados pela duração das visitas, com 30 minutos entre atividades. A programação fica salva neste navegador.</p></div>
        <fieldset disabled={savingEdit} className="grid gap-4 sm:grid-cols-3">
          <label className="form-label">Nome do roteiro<Input maxLength={160} value={activeDraft.title} onChange={e => setDraft({...activeDraft, title:e.target.value})} /></label>
          <label className="form-label">Ida<Input type="date" value={activeDraft.start_date ?? ""} onChange={e => setDraft({...activeDraft, start_date:e.target.value || null})} /></label>
          <label className="form-label">Volta<Input type="date" min={activeDraft.start_date || undefined} value={activeDraft.end_date ?? ""} onChange={e => setDraft({...activeDraft, end_date:e.target.value || null})} /></label>
        </fieldset>
      </section>}
      <div className="itinerary-layout">
        <section className="space-y-6" aria-label="Programação da viagem">
          <div className="day-tabs" role="tablist" aria-label="Dias do roteiro">
            {days.map((day, index) => <button key={day.id} type="button" role="tab" id={`day-tab-${index}`} aria-controls={`day-panel-${index}`} aria-selected={selectedDay === index} onClick={() => setSelectedDay(index)}>{`Dia ${day.day_number}`}</button>)}
          </div>
          {days.length === 0 ? <Feedback title="Ainda não existem dias gerados para este roteiro." description={itinerary.generation_status === "generating" ? "A programação aparecerá aqui quando a geração terminar." : undefined} /> : days.map((day, index) => selectedDay === index ? <div key={day.id} role="tabpanel" id={`day-panel-${index}`} aria-labelledby={`day-tab-${index}`} hidden={selectedDay !== index} className="space-y-5">
            <h2 className="section-title">{day.title}</h2>
            {day.summary && <p className="text-sm leading-6 text-muted-foreground">{day.summary}</p>}
            {activeDraft ? <fieldset disabled={savingEdit}><DayEditor day={day} destinationImage={visual.image} destinationName={visual.location} currency={itinerary.currency_code || "BRL"} update={next => setDraft(current => current ? {...current, days: current.days?.map(item => item.id === next.id ? next : item)} : current)} /></fieldset> : <ol className="space-y-5">{(day.events ?? []).map((event, eventIndex) => <ItineraryActivity key={event.id} event={event} index={eventIndex} currency={itinerary.currency_code || "BRL"} destinationImage={visual.image} destinationName={visual.location} />)}</ol>}
            {!activeDraft && !day.events?.length && <p className="text-muted-foreground">Nenhuma atividade neste dia.</p>}
          </div> : null)}
        </section>
        <aside className="itinerary-aside space-y-6">
          <DestinationImage src={visual.image} name={visual.location} className="h-44 rounded-2xl" />
          <div className="budget-panel space-y-5">
            <h2 className="text-xl">Sua viagem</h2>
            <p className="text-sm text-muted-foreground">{formatDate(itinerary.start_date)} — {formatDate(itinerary.end_date)}</p>
            <div className="space-y-2"><p className="text-sm text-muted-foreground">Orçamento total</p><p className="text-2xl font-semibold tabular-nums">{money(itinerary.budget_total, itinerary.currency_code || "BRL")}</p></div>
            <div className="space-y-2"><p className="text-sm text-muted-foreground">Estimativa do dia</p><p className="text-xl font-medium tabular-nums">{money(days[selectedDay]?.estimated_cost, itinerary.currency_code || "BRL")}</p></div>
            <p className="text-sm text-muted-foreground">{itinerary.duration_days ? `${itinerary.duration_days} dias` : "Duração a definir"} · {visual.location}</p>
          </div>
          {itinerary.summary && <p className="text-sm leading-6 text-muted-foreground">{itinerary.summary}</p>}
        </aside>
      </div>
      <ReviewsSection itinerary={itinerary} onChanged={() => setRevision((value) => value + 1)} />
      <div>
        <Button asChild variant="outline">
          {itinerary.is_owner === false ? (
            <Link to="/">Voltar para a Home</Link>
          ) : (
            <Link to="/roteiros">Voltar para seus roteiros</Link>
          )}
        </Button>
      </div>
    </section>
  );
}
