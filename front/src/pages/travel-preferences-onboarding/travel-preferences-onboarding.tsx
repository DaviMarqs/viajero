import { PartyPopper, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import type { Destination } from "@/types/travel";
import { TripCalendar } from "@/components/ui/trip-calendar";
import { tripDuration } from "@/lib/trip-dates";
import { readPlanningDraft, savePlanningDraft } from "@/lib/planning-draft";
import { useEffect, useRef, useState } from "react";
import OnboardingSidebar from "@/components/ui/onboarding-sidebar";
import OnboardingStepFields from "@/components/ui/onboarding-step-fields";
import { useOnboarding, type OnboardingSnapshot } from "@/hooks/useOnboarding";
import { useTripPreferences } from "@/hooks/useTripPreferences";
import { useAuth } from "@/contexts/authContext";
import {
  TRAVEL_PREFERENCES_SIDEBAR,
  TRAVEL_PREFERENCES_STEPS,
} from "./travel-preferences-onboarding.data";
import type {
  TripPreferenceUpsertInput,
  UserTripPreference,
} from "@/lib/profiles";

function currencyStringToNumber(value: string) {
  const parsed = parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function formatMoneyToInput(value: string | number) {
  const normalized = Number.parseFloat(String(value));
  if (!Number.isFinite(normalized)) return "";
  return String(Math.round(normalized * 100));
}

function getCardIndexes(stepKey: string, values: string[]) {
  const step = TRAVEL_PREFERENCES_STEPS.find((item) => item.key === stepKey);
  const cardsField = step?.fields.find((item) => item.type === "cards");
  if (!cardsField || cardsField.type !== "cards") return [];

  return cardsField.cards
    .map((card, index) => ({ value: String(card.value), index }))
    .filter((card) => values.includes(card.value))
    .map((card) => card.index);
}

function buildSnapshotFromPreferences(
  preferences: UserTripPreference,
): OnboardingSnapshot {
  return {
    fieldValues: {
      budget_min: formatMoneyToInput(preferences.budget_min),
      budget_max: formatMoneyToInput(preferences.budget_max),
      currency_code: preferences.currency_code,
      preferred_trip_length_days: String(
        preferences.preferred_trip_length_days,
      ),
      travel_month: preferences.travel_month,
      start_date: preferences.metadata?.start_date,
      end_date: preferences.metadata?.end_date,
    },
    tagValues: {
      dietary_preferences: preferences.dietary_preferences ?? [],
      accessibility_needs: preferences.accessibility_needs ?? [],
      interests: preferences.interests ?? [],
    },
    cardSelections: {
      companionship: getCardIndexes("companionship", [
        preferences.companionship,
      ]),
      timing: getCardIndexes("timing", [
        String(Boolean(preferences.metadata?.flexible_dates)),
      ]),
      stay: getCardIndexes("stay", [preferences.hotel_level]),
      transport: getCardIndexes("transport", [
        preferences.transportation_style,
      ]),
    },
  };
}

export default function TravelPreferencesOnboarding() {
  const location = useLocation();
  const { token: contextToken, user } = useAuth();
  const [restored] = useState(() => readPlanningDraft(user?.id));
  const passedState = location.state as { destination?: Destination; stepKey?: string } | null;
  const destination = passedState?.destination ?? restored?.destination;
  const navigate = useNavigate();
  const token =
    contextToken || localStorage.getItem("viajero.access_token") || "";
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const hydratedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {
    currentIndex,
    currentStep,
    isLast,
    finished,
    selectedCards,
    cardSelections,
    fieldValues,
    tagValues,
    hasSelection,
    toggleCard,
    setField,
    setTags,
    setSnapshot,
    prev,
    next,
    skip,
    getCardValues,
  } = useOnboarding(TRAVEL_PREFERENCES_STEPS);
  const { preferences, loading, saving, error, saveError, save } =
    useTripPreferences(token);

  useEffect(() => {
    if (loading || hydratedRef.current) return;
    const sameDestination = String(restored?.destination?.id ?? "") === String(destination?.id ?? "");
    const initial = sameDestination && restored?.snapshot ? restored.snapshot : preferences ? buildSnapshotFromPreferences(preferences) : {};
    const index = TRAVEL_PREFERENCES_STEPS.findIndex(step => step.key === passedState?.stepKey);
    setSnapshot({ ...initial, ...(index >= 0 ? { currentIndex: index } : {}) });
    setDraftNotice(sameDestination && restored?.snapshot ? "Rascunho recuperado neste navegador." : preferences ? "Preenchemos com suas últimas preferências. Revise para esta viagem." : "");
    hydratedRef.current = true;
    setDraftReady(true);
  }, [preferences, loading, restored, destination?.id, passedState?.stepKey, setSnapshot]);

  useEffect(() => {
    if (!draftReady || saving) return;
    const persist = () => { if (!savePlanningDraft(user?.id, { destination, tripPreferences: undefined, snapshot: { currentIndex, fieldValues, tagValues, cardSelections } })) setDraftNotice("Não foi possível guardar o rascunho neste navegador. Mantenha esta página aberta para continuar."); };
    const timer = window.setTimeout(persist, 200);
    window.addEventListener("pagehide", persist);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", persist); };
  }, [draftReady, saving, user?.id, destination, currentIndex, fieldValues, tagValues, cardSelections]);

  const flexibleDatesValue = getCardValues("timing")[0] === "true";
  const fixedDuration = tripDuration(fieldValues.start_date, fieldValues.end_date);
  const validBudget = !!fieldValues.budget_min?.trim() && !!fieldValues.budget_max?.trim() && currencyStringToNumber(fieldValues.budget_min) <= currencyStringToNumber(fieldValues.budget_max) && currencyStringToNumber(fieldValues.budget_max) > 0;
  const canAdvance = currentStep.key === "budget" ? hasSelection() && validBudget : currentStep.key === "timing" && !flexibleDatesValue
    ? getCardValues("timing").length > 0 && fixedDuration != null && fixedDuration <= 60
    : hasSelection();
  const visibleStep = currentStep.key === "timing" && !flexibleDatesValue ? { ...currentStep, fields: currentStep.fields.filter(field => field.type === "cards") } : currentStep;
  const companionship = getCardValues("companionship")[0] ?? "";
  useEffect(() => { headingRef.current?.focus(); }, [currentIndex]);

  async function handleFinish() {
    const budgetMin = currencyStringToNumber(fieldValues.budget_min ?? "");
    const budgetMax = currencyStringToNumber(fieldValues.budget_max ?? "");
    let tripLength = parseInt(
      fieldValues.preferred_trip_length_days ?? "0",
      10,
    );
    const hotelLevel = getCardValues("stay")[0] ?? "";
    const transportationStyle = getCardValues("transport")[0] ?? "";

    if (!fieldValues.budget_min?.trim() || !Number.isFinite(budgetMin) || budgetMin < 0 || !budgetMax) {
      setSubmitError("Informe a faixa de Orçamento antes de continuar.");
      return;
    }

    if (budgetMin > budgetMax) {
      setSubmitError("O Orçamento mínimo não pode ser maior que o máximo.");
      return;
    }

    if (
      (flexibleDatesValue && (!tripLength || tripLength > 60)) ||
      !fieldValues.currency_code ||
      !companionship ||
      (flexibleDatesValue && !fieldValues.travel_month) ||
      !hotelLevel ||
      !transportationStyle
    ) {
      setSubmitError("Preencha as etapas obrigatorias antes de concluir.");
      return;
    }

    if (!flexibleDatesValue) {
      if (!fieldValues.start_date || !fieldValues.end_date || fieldValues.end_date < fieldValues.start_date) {
        setSubmitError("Informe as datas de ida e volta desta viagem."); return;
      }
      tripLength = Math.round((Date.parse(fieldValues.end_date) - Date.parse(fieldValues.start_date)) / 86400000) + 1;
      if (tripLength < 1 || tripLength > 60) { setSubmitError("A viagem deve durar entre 1 e 60 dias."); return; }
    }
    if (!(tagValues.interests ?? []).length) { setSubmitError("Selecione ao menos um interesse desta viagem."); return; }
    const payload: TripPreferenceUpsertInput = {
      budget_min: budgetMin,
      budget_max: budgetMax,
      currency_code: fieldValues.currency_code,
      companionship,
      preferred_trip_length_days: tripLength,
      travel_month: !flexibleDatesValue
        ? new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(`${fieldValues.start_date}T00:00:00Z`))
        : fieldValues.travel_month ?? "",
      hotel_level: hotelLevel,
      transportation_style: transportationStyle,
      dietary_preferences: tagValues.dietary_preferences ?? [],
      accessibility_needs: tagValues.accessibility_needs ?? [],
      interests: tagValues.interests ?? [],
      metadata: {
        flexible_dates: flexibleDatesValue,
        ...(!flexibleDatesValue ? { start_date: fieldValues.start_date, end_date: fieldValues.end_date } : {}),
      },
    };

    setSubmitError(null);
    try {
      const savedPreferences = await save(payload);
      const preferencesId = savedPreferences?.id;
      savePlanningDraft(user?.id, { destination, tripPreferences: payload, snapshot: { currentIndex, fieldValues, tagValues, cardSelections } });

      navigate(
        preferencesId
          ? `/roteiros/criacao?preferences_id=${preferencesId}`
          : "/roteiros/criacao",
        {
          replace: true,
          state: { preferencesId, destination, tripPreferences: payload },
        },
      );
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message);
        return;
      }
      setSubmitError("Não foi possível salvar suas preferências agora.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Carregando preferências...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl border border-red-100 bg-white px-6 py-8 text-center">
          <AlertCircle className="size-6 text-red-500" />
          <p className="text-sm leading-6 text-muted-foreground">{error}</p>
          <button type="button" className="min-h-11 text-sm font-medium text-primary underline" onClick={() => navigate(0)}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="onboarding-shell">
        <OnboardingSidebar
          currentIndex={currentIndex}
          steps={TRAVEL_PREFERENCES_STEPS}
          title={TRAVEL_PREFERENCES_SIDEBAR.title}
          description={TRAVEL_PREFERENCES_SIDEBAR.description}
        />
        <main className="flex min-w-0 flex-1 px-6 py-8 sm:px-8 lg:p-10">
          <div className="flex flex-1 items-center justify-center rounded-card border border-border bg-white px-6 py-10">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <PartyPopper
                size={52}
                strokeWidth={1.5}
                className="text-primary"
              />
              <h2 className="text-4xl font-semibold text-foreground">
                preferências salvas!
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Seu perfil de viagem foi atualizado e já pode ser usado na
                geração de roteiros.
              </p>
              <Link
                to="/"
                className="mt-2 inline-flex h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                Voltar para a home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hasCards = currentStep.fields.some((field) => field.type === "cards");

  return (
    <div className="onboarding-shell">
      <OnboardingSidebar
        currentIndex={currentIndex}
        steps={TRAVEL_PREFERENCES_STEPS}
        title={TRAVEL_PREFERENCES_SIDEBAR.title}
        description={TRAVEL_PREFERENCES_SIDEBAR.description}
      />

      <main className="flex min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:p-10">
        <div className="flex w-full flex-col rounded-card border border-border bg-white p-6 sm:p-8 lg:p-10">
          <header className="flex flex-col gap-3">
            {/* NOVO BOTÃO DE VOLTAR AQUI */}
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={prev}
                disabled={saving}
                className="mb-2 flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                <ArrowLeft className="size-4" />
                Voltar
              </button>
            )}

            <p className="text-sm text-muted-foreground">Etapa {currentIndex + 1} de {TRAVEL_PREFERENCES_STEPS.length}</p>
            <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-foreground">
              {currentStep.title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {currentStep.sub}
            </p>
            {hasCards &&
              currentStep.fields.some((field) => field.type === "cards") && (
                <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary">
                  Escolha a opção que melhor descreve sua preferência
                </span>
              )}
          </header>

          <div className="mt-8 flex flex-1 flex-col gap-5">
            <p className="text-sm text-muted-foreground">Configuração desta viagem. Seu DNA de viajante permanece no perfil.</p>
            {draftNotice && <p role="status" className="text-sm text-strong">{draftNotice}</p>}
            {currentStep.key === "budget" && fieldValues.budget_min && fieldValues.budget_max && !validBudget && <p role="alert" className="text-sm text-destructive">O máximo deve ser maior que zero e igual ou superior ao mínimo.</p>}
            <OnboardingStepFields
              currentStep={visibleStep}
              selectedCards={selectedCards}
              fieldValues={fieldValues}
              tagValues={tagValues}
              onToggleCard={toggleCard}
              onSetField={setField}
              onSetTags={setTags}
            />
            {currentStep.key === "timing" && !flexibleDatesValue && <TripCalendar start={fieldValues.start_date ?? ""} end={fieldValues.end_date ?? ""} onChange={(start, end) => { setField("start_date", start); setField("end_date", end); }} />}
          </div>

          {(submitError || saveError) && (
            <div role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{submitError || saveError}</span>
            </div>
          )}

          <footer className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center rounded-control bg-primary text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted-foreground"
              onClick={isLast ? handleFinish : next}
              disabled={!canAdvance || saving}
            >
              {saving
                ? "Salvando..."
                : isLast
                  ? "Revisar minha viagem"
                  : "Próximo"}
            </button>

            {!isLast && currentStep.key === "needs" && (
              <button
                type="button"
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                onClick={skip}
                disabled={saving}
              >
                Pular essa etapa
              </button>
            )}
          </footer>
        </div>
      </main>
    </div>
  );
}
