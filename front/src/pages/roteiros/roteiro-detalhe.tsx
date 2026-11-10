import { ItineraryHeader } from "@/features/itineraries/itinerary-header";
import { tripMilestones } from "@/features/itineraries/trip-milestones";
import { TabStrip } from "@/components/motion/tab-strip";
import { DayTabLabel } from "@/components/ui/day-tab-label";
import { Feedback, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useParams } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  itineraryPresentation,
  itineraryStatus,
} from "@/features/itineraries/itinerary-presentation";
import { useDestinations } from "@/hooks/useDestinations";
import { ReviewsSection } from "@/features/reviews/reviews-section";
import type { Itinerary } from "@/types/travel";
import { useMoney } from "@/contexts/currencyContext";
import { useToast } from "@/components/motion/toast-context";
import { DayEditor, ItineraryDetailsEditor, ItineraryEditToolbar } from "@/features/itineraries/itinerary-editor";
import { tripHasEnded } from "@/features/itineraries/itinerary-editing";
import { ItineraryActivity } from "@/features/itineraries/itinerary-activity";
import { FavoriteItineraryButton } from "@/features/itineraries/favorite-itinerary-button";
import { RegenerateItineraryButton } from "@/features/itineraries/regenerate-itinerary-button";
import { dayInsights } from "@/features/itineraries/itinerary-insights";
import { clearLegacyPrograms, moveEvent, removeEvent, reorderEvent } from "@/features/itineraries/program-sync";
import { useItineraryProgram } from "@/features/itineraries/use-itinerary-program";

type ItineraryResponse = ApiSuccessResponse<Itinerary>;

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export default function RoteiroDetalhePage() {
  const { money } = useMoney();
  const notify = useToast();
  const { id } = useParams();
  const { destinations } = useDestinations();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState(0);
  const [revision, setRevision] = useState(0);
  // Edição salva no servidor (#50): cada ação aparece na hora e vai para a fila de salvamento.
  const program = useItineraryProgram(itinerary, setItinerary);
  const pendingTitle = program.titleDraft?.trim();
  const hasUnsavedChanges = program.busy || program.canRetry || (!!pendingTitle && pendingTitle !== itinerary?.title);
  // A programação editada ficava no navegador; agora vive no servidor e a cópia antiga só atrapalha.
  useEffect(() => { clearLegacyPrograms(window.localStorage); }, []);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [hasUnsavedChanges]);
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
        setItinerary(response.data ?? null);
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
  }, [id, revision]);
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
        <div className="rounded-card border border-border bg-background px-6 py-6 text-sm text-muted-foreground">
          Nenhum roteiro foi encontrado para esse identificador.
        </div>
      </section>
    );
  }

  const days = itinerary.days ?? [];
  const visual = itineraryPresentation(itinerary, destinations);
  const daily = dayInsights(days[selectedDay]);
  const canEdit = itinerary.is_owner === true && itinerary.generation_status === "ready";
  const isEditing = editing && canEdit;
  function changeProgram(change: Parameters<typeof program.changeDays>[0], toast?: string) {
    const problem = program.changeDays(change);
    if (problem) notify({ title: problem });
    else if (toast) notify({ title: toast, action: { label: "Desfazer", onClick: () => void program.undo() } });
  }
  return (
    <section className="page-content itinerary-detail" data-editing={isEditing}>
      <Breadcrumbs current={itinerary.title} parent={{ label: "Roteiros", to: "/roteiros" }} />
      <ItineraryHeader key={itinerary.id}>{compact => <>
        <div className="itinerary-header-identity space-y-3">
          <h1 className="page-title itinerary-header-title">Viagem · {itinerary.title}</h1>
          <p className="itinerary-header-context text-muted-foreground">
            {visual.location} · {visual.country || "País não informado"} · {itinerary.duration_days ? `${itinerary.duration_days} dias` : "Duração a definir"} · {formatDate(itinerary.start_date)} — {formatDate(itinerary.end_date)}
          </p>
        </div>
        <div className="itinerary-header-actions action-bar">
          <span
            className="status-badge itinerary-header-extra"
            data-status={itinerary.generation_status}
          >
            {itineraryStatus(itinerary.generation_status)}
          </span>
          {canEdit && (
            <ItineraryEditToolbar
              editing={isEditing}
              status={program.status}
              error={program.error}
              canRetry={program.canRetry}
              canUndo={program.canUndo}
              undoing={program.undoing}
              onEdit={() => setEditing(true)}
              onFinish={() => { program.flushTitle(); setEditing(false); }}
              onUndo={() => void program.undo()}
              onRetry={program.retry}
            />
          )}
          {itinerary.is_owner &&
            !isEditing &&
            !program.busy &&
            (itinerary.generation_status === "ready" || itinerary.generation_status === "failed") && (
              <div className="itinerary-header-extra"><RegenerateItineraryButton
                itinerary={itinerary}
                onRegenerated={(next) => {
                  setItinerary(next);
                  setSelectedDay(0);
                }}
              /></div>
            )}
          <FavoriteItineraryButton itineraryId={itinerary.id} compact={compact} />
          {itinerary.generation_status === "ready" &&
            (!itinerary.is_owner || tripHasEnded(itinerary.end_date)) && (
              <Button asChild variant="ghost" className="itinerary-header-extra">
                <a href="#avaliacoes">
                  <Star aria-hidden="true" />
                  {itinerary.is_owner
                    ? "Avaliar minha viagem"
                    : "Avaliar roteiro"}
                </a>
              </Button>
            )}
        </div>
        {days[selectedDay] && <div className="itinerary-header-summary"><strong>{isEditing ? "Editando" : "Programação"} · Dia {days[selectedDay].day_number} · <DayTabLabel start={itinerary.start_date} day={days[selectedDay].day_number} /></strong><span>{daily.activities ? `${daily.activities} atividades` : "Dia livre"}</span><span>Visitas{daily.missingDurations ? " informadas" : ""}: {daily.visitMinutes ? `${Math.floor(daily.visitMinutes / 60)}h ${daily.visitMinutes % 60}min` : "Não informado"}</span><span>Custo conhecido: {daily.activities && daily.missingCosts === daily.activities ? "Não informado" : money(daily.knownCost, itinerary.currency_code || "BRL")}{daily.missingCosts > 0 && daily.missingCosts < daily.activities ? " (parcial)" : ""}</span></div>}
      </>}</ItineraryHeader>
      {isEditing && <section className="edit-mode-panel space-y-4" aria-label="Modo de edição">
        <div><h2 className="text-lg">Modo de edição ativado</h2><p className="mt-1 text-sm text-muted-foreground">Cada alteração é salva automaticamente. Arraste pela alça ou use as setas para reordenar, leve uma atividade para outro dia ou remova. Os horários são recalculados pela duração das visitas, com 30 minutos entre atividades.</p></div>
        <ItineraryDetailsEditor itinerary={itinerary} titleDraft={program.titleDraft} disabled={program.undoing} onTitleChange={program.editTitle} onStartDateCommit={program.editStartDate} />
      </section>}
      <div className="itinerary-layout">
        <section className="space-y-6" aria-label="Programação da viagem">
          <TabStrip label="Dias do roteiro" selected={selectedDay}>
            {days.map((day, index) => <button key={day.id} type="button" role="tab" tabIndex={selectedDay === index ? 0 : -1} id={`day-tab-${index}`} aria-controls={`day-panel-${index}`} aria-selected={selectedDay === index} onClick={() => setSelectedDay(index)} onKeyDown={event => { const next = event.key === "ArrowRight" ? (index + 1) % days.length : event.key === "ArrowLeft" ? (index + days.length - 1) % days.length : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : null; if (next != null) { event.preventDefault(); setSelectedDay(next); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#day-tab-${next}`)?.focus(); } }}>Dia {day.day_number} · <DayTabLabel start={itinerary.start_date} day={day.day_number} /></button>)}
          </TabStrip>
          {days.length === 0 ? <Feedback title="Ainda não existem dias gerados para este roteiro." description={itinerary.generation_status === "generating" ? "A programação aparecerá aqui quando a geração terminar." : undefined} /> : days.map((day, index) => selectedDay === index ? <div key={day.id} role="tabpanel" id={`day-panel-${index}`} aria-labelledby={`day-tab-${index}`} hidden={selectedDay !== index} className="space-y-5">
            <h2 className="section-title">Dia {day.day_number} · {day.title}</h2>
            {day.summary && <p className="text-sm leading-6 text-muted-foreground">{day.summary}</p>}
            <dl className="day-overview"><div><dt>Atividades</dt><dd>{daily.activities}</dd></div><div><dt>Tempo de visitas{daily.missingDurations ? " informado" : ""}</dt><dd>{daily.visitMinutes ? `${Math.floor(daily.visitMinutes / 60)}h ${daily.visitMinutes % 60}min` : "Não informado"}</dd></div><div><dt>Custo conhecido do dia</dt><dd>{daily.activities ? daily.missingCosts === daily.activities ? "—" : money(daily.knownCost, itinerary.currency_code || "BRL") : "Dia livre"}</dd></div></dl>
            {(daily.missingCosts > 0 || daily.missingDurations > 0) && <p className="text-sm text-muted-foreground">{daily.missingCosts > 0 && `${daily.missingCosts} atividades sem custo informado. `}{daily.missingDurations > 0 && `${daily.missingDurations} atividades sem duração informada.`}</p>}
            {daily.activities > 1 && <p className="text-xs text-muted-foreground">O tempo de visitas não inclui deslocamentos. Intervalos da programação não representam uma estimativa de trajeto real.</p>}
            {tripMilestones(itinerary, day.day_number).filter(mark => mark.kind === "arrival").map(mark => <p key={mark.kind} className="trip-milestone"><strong>Chegada</strong> · {formatDate(mark.date)} · {mark.time || "Horário não informado"}</p>)}
            {isEditing ? <fieldset disabled={program.undoing}><DayEditor day={day} days={days} startDate={itinerary.start_date} destinationImage={visual.image} destinationName={visual.location} currency={itinerary.currency_code || "BRL"} onReorder={(from, to) => changeProgram(current => reorderEvent(current, day.day_number, from, to))} onMove={(event, target) => changeProgram(current => moveEvent(current, event.id, target), `Atividade movida para o dia ${target}.`)} onRemove={event => changeProgram(current => removeEvent(current, event.id), "Atividade removida.")} /></fieldset> : <ol className="space-y-5">{(day.events ?? []).map((event, eventIndex) => <ItineraryActivity key={event.id} event={event} index={eventIndex} currency={itinerary.currency_code || "BRL"} destinationImage={visual.image} destinationName={visual.location} />)}</ol>}
            {tripMilestones(itinerary, day.day_number).filter(mark => mark.kind === "departure").map(mark => <p key={mark.kind} className="trip-milestone"><strong>Partida</strong> · {formatDate(mark.date)} · {mark.time || "Horário não informado"}</p>)}
            {!isEditing && !day.events?.length && <p className="text-muted-foreground">Nenhuma atividade neste dia.</p>}
          </div> : null)}
        </section>
        <aside className="itinerary-aside space-y-6">
          <div className="budget-panel space-y-5">
            <h2 className="text-xl">Sua viagem</h2>
            <div className="space-y-2"><p className="text-sm text-muted-foreground">Custo conhecido das atividades</p><p className="text-2xl font-medium tabular-nums">{itinerary.budget_total == null || itinerary.budget_total === "" ? "—" : money(itinerary.budget_total, itinerary.currency_code || "BRL")}</p></div>
            <p className="text-xs text-muted-foreground">Este valor não representa o orçamento completo da viagem. Custos ausentes não são tratados como zero.</p>
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
