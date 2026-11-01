import { PlanningSkeleton } from "@/components/ui/planning-skeleton";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { StepTransition } from "@/components/motion/step-transition";
import { planningPeriod } from "@/components/ui/planning-date";
import { PlanningSteps } from "@/components/ui/planning-steps";
import { Button } from "@/components/ui/button";
import { PartyPopper, AlertCircle } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import type { Destination } from "@/types/travel";
import { TripCalendar } from "@/components/ui/trip-calendar";
import { tripDuration } from "@/lib/trip-dates";
import { readPlanningDraft, savePlanningDraft, clearPlanningDraft } from "@/lib/planning-draft";
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

function planningQuestion(key: string, fallback: string) { return ({ budget: "Quanto deseja investir na viagem?", companionship: "Com quem você vai viajar?", timing: "Quando você quer viajar?", stay: "Como prefere se hospedar?", transport: "Como deseja se deslocar?", needs: "Quais cuidados devemos considerar?", interests: "O que quer descobrir nesta viagem?" } as Record<string, string>)[key] ?? fallback; }

export default function TravelPreferencesOnboarding() {
  const location = useLocation();
  const { token: contextToken, user } = useAuth();
  const [restored] = useState(() => readPlanningDraft(user?.id));
  const passedState = location.state as { destination?: Destination; stepKey?: string } | null;
  const destination = passedState?.destination ?? restored?.destination;
  const navigate = useNavigate();
  const token =
    contextToken || localStorage.getItem("viajero.access_token") || "";
  const [budgetTouched, setBudgetTouched] = useState(false);
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
    setCurrentStep,
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
  const displayDuration = flexibleDatesValue ? Number(fieldValues.preferred_trip_length_days) : fixedDuration;
  const dailyMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: fieldValues.currency_code || "BRL" }).format(value);
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
      await save(payload);
      const reviewedDestination = destination;
      savePlanningDraft(user?.id, { destination: reviewedDestination, tripPreferences: payload, snapshot: { currentIndex, fieldValues, tagValues, cardSelections } });
      navigate("/roteiros/criacao", { replace: true, state: { destination: reviewedDestination, tripPreferences: payload } });
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message);
        return;
      }
      setSubmitError("Não foi possível salvar suas preferências agora.");
    }
  }

  if (loading) return <PlanningSkeleton steps={TRAVEL_PREFERENCES_STEPS.length} />;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-line bg-white px-6 py-8 text-center">
          <AlertCircle className="size-6 text-ink-muted" />
          <p className="text-sm leading-6 text-muted-foreground">{error}</p>
          <button type="button" className="min-h-11 text-sm font-medium text-ink underline" onClick={() => navigate(0)}>Tentar novamente</button>
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
                className="text-ink-muted"
              />
              <h2 className="text-4xl font-medium text-foreground">
                preferências salvas!
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Seu perfil de viagem foi atualizado e já pode ser usado na
                geração de roteiros.
              </p>
              <Link
                to="/"
                className="mt-2 inline-flex h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-hover"
              >
                Voltar para a home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <div className="planning-page">
    <div className="planning-context"><span className="planning-destination">{destination?.name || "Destino a definir"}</span><span className="planning-data">{flexibleDatesValue ? (TRAVEL_PREFERENCES_STEPS.flatMap(step => step.fields).flatMap(field => field.type === "dropdown" && field.key === "travel_month" ? field.options : []).find(option => option.value === fieldValues.travel_month)?.label || "Mês a definir") : planningPeriod(fieldValues.start_date, fieldValues.end_date)}</span><span className="planning-data">{!flexibleDatesValue && fixedDuration ? `${fixedDuration} dias` : fieldValues.preferred_trip_length_days ? `${fieldValues.preferred_trip_length_days} dias · flexíveis` : "Duração a definir"}</span><Link to="/destinos" className="planning-exit">Sair</Link></div>
    <div className="planning-layout">
      <PlanningSteps steps={TRAVEL_PREFERENCES_STEPS} currentIndex={currentIndex} fieldValues={fieldValues} tagValues={tagValues} cardSelections={cardSelections} onSelect={setCurrentStep} />
      <section className="planning-content"><div className="planning-scroll min-h-0 overflow-y-auto" tabIndex={0} aria-label="Conteúdo da etapa">
        {draftNotice && !draftNotice.startsWith("Preenchemos") && <div role="status" className="planning-draft-notice"><span>{draftNotice}</span>{restored?.snapshot && <Button variant="ghost" onClick={() => { clearPlanningDraft(user?.id); setSnapshot({ currentIndex: 0, fieldValues: {}, tagValues: {}, cardSelections: {} }); setDraftNotice(""); }}>Descartar rascunho</Button>}</div>}
        <StepTransition step={currentIndex}><header className="planning-heading"><p className="text-xs text-muted-foreground">{currentStep.label} · Etapa {currentIndex + 1} de {TRAVEL_PREFERENCES_STEPS.length}</p><h1 ref={headingRef} tabIndex={-1}>{planningQuestion(currentStep.key, currentStep.title)}</h1><p className="text-sm text-muted-foreground">{currentStep.key === "timing" ? "Escolha como tratar as datas desta viagem." : currentStep.key === "budget" ? "Defina uma faixa de gasto para esta viagem." : currentStep.key === "needs" ? "Indique os cuidados que a viagem precisa considerar." : currentStep.sub}</p></header>
        <div className={`planning-controls planning-step-card ${currentStep.key === "timing" ? "planning-period-card" : ""}`}><OnboardingStepFields currentStep={visibleStep} selectedCards={selectedCards} fieldValues={fieldValues} tagValues={tagValues} onToggleCard={toggleCard} onSetField={(key, value) => { if (key === "budget_min" || key === "budget_max") setBudgetTouched(true); setField(key, value); }} onSetTags={setTags} prefilled={!!preferences && !restored?.snapshot} fieldErrors={{ budget_max: fieldValues.budget_min && fieldValues.budget_max && !validBudget ? "O máximo deve ser maior que zero e igual ou superior ao mínimo. Ajuste este valor." : undefined }} />{currentStep.key === "timing" && getCardValues("timing")[0] === "false" && <TripCalendar start={fieldValues.start_date ?? ""} end={fieldValues.end_date ?? ""} onChange={(start, end) => { setField("start_date", start); setField("end_date", end); }} />}

{currentStep.key === "timing" && flexibleDatesValue && <span className="field-support">Posso adaptar o período se isso melhorar preço ou experiência.</span>}</div>
        {currentStep.key === "budget" && <p className="field-support planning-data">{validBudget && fieldValues.currency_code && displayDuration && displayDuration > 0 && displayDuration <= 60 ? <>≈ <AnimatedNumber value={currencyStringToNumber(fieldValues.budget_min ?? "") / displayDuration} format={dailyMoney} animate={budgetTouched} /> a <AnimatedNumber value={currencyStringToNumber(fieldValues.budget_max ?? "") / displayDuration} format={dailyMoney} animate={budgetTouched} /> por dia · total ÷ {displayDuration} dias</> : "A referência por dia aparece ao informar os valores e a duração."}</p>}
        {currentIndex === 0 && <p className="field-support planning-dna-note">Estas escolhas valem só para esta viagem. Seu DNA de viajante continua no perfil.</p>}
        {(submitError || saveError) && <p role="alert" className="planning-notice text-sm">{submitError || saveError}</p>}
        </StepTransition></div>
        <footer className="planning-footer">{currentIndex > 0 && <Button variant="ghost" onClick={prev} disabled={saving}>Voltar</Button>}
        {!canAdvance && <p id="planning-required" className="text-xs text-muted-foreground">{currentStep.key === "timing" ? !flexibleDatesValue ? "Selecione ida e volta para continuar" : "Informe duração e mês para continuar" : "Preencha os campos obrigatórios ou selecione uma opção para continuar."}</p>}
{!isLast && currentStep.key === "needs" && <Button variant="ghost" onClick={skip} disabled={saving}>Pular essa etapa</Button>}<Button onClick={isLast ? handleFinish : next} loading={saving} disabled={!canAdvance} aria-describedby={!canAdvance ? "planning-required" : undefined}>{isLast ? destination ? "Revisar viagem" : "Sugerir meu destino" : "Continuar"}</Button></footer>
      </section>
    </div>
  </div>;
}
