import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { localizedDestination } from "@/lib/destination-language";
import { suggestDestination } from "@/lib/destinations";
import { generateItinerary } from "@/features/itineraries/generation-service";
import { DestinationImage } from "@/features/destinations/destination-card";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import type { TripPreferenceUpsertInput } from "@/lib/profiles";
import type { Destination } from "@/types/travel";
import { useAuth } from "@/contexts/authContext";
import { TripReview } from "@/features/itineraries/trip-review";
import { clearPlanningDraft, readPlanningDraft, savePlanningDraft } from "@/lib/planning-draft";

export default function RoteiroCriacaoPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const passed = location.state as { destination?: Destination; tripPreferences?: TripPreferenceUpsertInput } | null;
  const [restored] = useState(() => readPlanningDraft(user?.id));
  const tripPreferences = passed?.tripPreferences ?? (passed?.destination ? undefined : restored?.tripPreferences);
  const initialDestination = passed?.destination ?? (passed?.tripPreferences ? undefined : restored?.destination);
  const [selected, setSelected] = useState<Destination | null>(initialDestination ?? null);
  const [suggestionRevision, setSuggestionRevision] = useState(initialDestination ? 0 : 1);
  const [busy, setBusy] = useState(!initialDestination);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [draftError, setDraftError] = useState("");
  const [createdId, setCreatedId] = useState<number | string | undefined>();
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!tripPreferences || !suggestionRevision) return;
    const request = new AbortController();
    void suggestDestination(tripPreferences, request.signal).then(destination => {
      if (request.signal.aborted) return;
      if (!destination?.id || !destination.name) throw new Error("Nenhum destino disponível para sugerir agora. Tente novamente.");
      setSelected(localizedDestination(destination));
    }).catch(err => {
      if (!request.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível sugerir um destino.");
    }).finally(() => {
      if (!request.signal.aborted) setBusy(false);
    });
    return () => request.abort();
  }, [tripPreferences, suggestionRevision]);

  useEffect(() => {
    if (!selected || !tripPreferences || createdId) return;
    const persist = () => {
      if (!savePlanningDraft(user?.id, { destination: selected, tripPreferences })) setDraftError("Não foi possível guardar o rascunho neste navegador.");
    };
    const timer = window.setTimeout(persist, 200);
    window.addEventListener("pagehide", persist);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", persist); };
  }, [selected, tripPreferences, createdId, user?.id]);

  function requestSuggestion() {
    setBusy(true);
    setSelected(null);
    setError(null);
    setSuggestionRevision(value => value + 1);
  }

  async function generate() {
    if (!selected || !tripPreferences || busy || locked.current || createdId) return;
    locked.current = true;
    setGenerating(true);
    setError(null);
    const request = new AbortController();
    controller.current = request;
    try {
      const itinerary = await generateItinerary(selected, tripPreferences, request.signal, next => {
        setProgress(next.message);
        if (next.itineraryId) { setCreatedId(next.itineraryId); clearPlanningDraft(user?.id); }
      });
      navigate("/roteiros/" + itinerary.id);
    } catch (err) {
      if (!request.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível gerar o roteiro.");
    } finally {
      locked.current = false;
      if (!request.signal.aborted) setGenerating(false);
    }
  }

  if (!tripPreferences) return <Navigate to="/onboard/preferências" replace state={{ destination: initialDestination }} />;
  const card = selected && destinationCardData(selected);
  return <section className="page-content">
    <Breadcrumbs current="Criar roteiro" parent={{ label: "Roteiros", to: "/roteiros" }} />
    <section className="creation-panel space-y-6">
      <ol className="planning-progress" aria-label="Etapas do planejamento">
        <li>Preferências da viagem</li>
        <li aria-current={busy ? "step" : undefined}>Sugestão de destino</li>
        <li aria-current={selected && !busy && !generating ? "step" : undefined}>Revisão</li>
        <li aria-current={generating ? "step" : undefined}>Geração</li>
      </ol>
      <header className="max-w-2xl space-y-2">
        <h1 className="page-title">{generating ? "Seu roteiro está a caminho" : busy ? "Descobrindo seu próximo destino" : selected ? "Uma viagem com o seu jeito" : "Vamos encontrar seu destino"}</h1>
        <p className="text-muted-foreground">{selected ? "Confira o destino sugerido e as preferências desta viagem antes de gerar seu roteiro." : "Usamos as escolhas desta viagem para sugerir um destino que combine com você."}</p>
      </header>
      {draftError && <p role="status" className="text-sm text-destructive">{draftError}</p>}
      {busy && <Feedback kind="loading" title="Buscando seu próximo destino…" description="Considerando o orçamento, o período e os interesses desta viagem." />}
      {error && <Feedback kind="error" title="Não foi possível concluir" description={error} onRetry={createdId ? undefined : selected ? () => void generate() : requestSuggestion}>
        {createdId && <Button asChild><Link to={"/roteiros/" + createdId}>Abrir roteiro criado</Link></Button>}
      </Feedback>}
      {generating && <Feedback kind="loading" title="Montando seu roteiro" description={progress} />}
      {selected && card && !busy && !generating && !createdId && <>
        <div className="destination-result flex flex-col gap-6 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center">
          <DestinationImage src={card.image} name={selected.name} className="result-image h-40 w-full shrink-0 rounded-card sm:w-56" />
          <div className="min-w-0 space-y-3"><h2 className="section-title">{selected.name}</h2><p className="text-sm text-strong">{selected.country}</p><p className="text-sm text-muted-foreground">{selected.summary}</p></div>
        </div>
        <TripReview destination={selected} preferences={tripPreferences} onChangeDestination={requestSuggestion} onEdit={stepKey => navigate("/onboard/preferências", { state: { destination: selected, stepKey } })} />
        <div className="surface flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Tudo certo para esta viagem?</p><Button onClick={generate}>Confirmar e gerar roteiro</Button></div>
      </>}
      {createdId && <p className="text-sm text-muted-foreground">Sair desta tela interrompe apenas o acompanhamento. <Link className="text-ink underline" to="/roteiros">Ver meus roteiros</Link></p>}
    </section>
  </section>;
}
