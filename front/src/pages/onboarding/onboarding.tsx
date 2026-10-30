import { Feedback } from "@/components/ui/feedback";
import { PlanningSkeleton } from "@/components/ui/planning-skeleton";
import { StepTransition } from "@/components/motion/step-transition";
import { PlanningSteps } from "@/components/ui/planning-steps";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import OnboardingSidebar from "../../components/ui/onboarding-sidebar";
import OnboardingStepFields from "@/components/ui/onboarding-step-fields";
import {
  useOnboarding,
  type OnboardingSnapshot,
} from "../../hooks/useOnboarding";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import { useTripPreferences } from "@/hooks/useTripPreferences";
import { useAuth } from "@/contexts/authContext";
import { ONBOARDING_STEPS } from "./onboarding.data";
import type { TravelerDNAProfile } from "@/lib/profiles";

function getProfileNotes(rawNotes: string | null | undefined) {
  if (!rawNotes) return "";

  try {
    const parsed = JSON.parse(rawNotes) as { text?: unknown; };
    return typeof parsed?.text === "string" ? parsed.text : "";
  } catch {
    return rawNotes;
  }
}

function getCardIndexes(stepKey: string, values: string[]) {
  const step = ONBOARDING_STEPS.find((item) => item.key === stepKey);
  const cardsField = step?.fields.find((item) => item.type === "cards");
  if (!cardsField || cardsField.type !== "cards") return [];

  return cardsField.cards
    .map((card, index) => ({ value: String(card.value), index }))
    .filter((card) => values.includes(card.value))
    .map((card) => card.index);
}

function buildSnapshotFromExistingData(
  profile: TravelerDNAProfile | null,
): OnboardingSnapshot {
  return {
    fieldValues: {
      travel_style: profile?.travel_style ?? "",
      pace: profile?.pace ?? "",
      comfort_level: profile?.comfort_level ?? "",
      social_energy: profile?.social_energy
        ? String(profile.social_energy)
        : "5",
      adventure_level: profile?.adventure_level
        ? String(profile.adventure_level)
        : "5",
      food_focus: profile?.food_focus ? String(profile.food_focus) : "5",
      cultural_interest: profile?.cultural_interest
        ? String(profile.cultural_interest)
        : "5",
      nature_interest: profile?.nature_interest
        ? String(profile.nature_interest)
        : "5",
      nightlife_interest: profile?.nightlife_interest
        ? String(profile.nightlife_interest)
        : "5",
      notes: getProfileNotes(profile?.notes),
    },
    tagValues: {},
    cardSelections: {
      estilo: profile?.travel_style
        ? getCardIndexes("estilo", [profile.travel_style])
        : [],
      ritmo: profile?.pace ? getCardIndexes("ritmo", [profile.pace]) : [],
      conforto: profile?.comfort_level
        ? getCardIndexes("conforto", [profile.comfort_level])
        : [],
    },
  };
}

export default function Onboarding() {
  const { token: contextToken } = useAuth();
  const token =
    contextToken || localStorage.getItem("viajero.access_token") || "";
  const hydratedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    buildProfilePayload,
  } = useOnboarding(ONBOARDING_STEPS);
  useEffect(() => { headingRef.current?.focus(); }, [currentIndex]);
  const dna = useTravelerDNAProfile(token);
  const tripPreferences = useTripPreferences(token);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (dna.loading || tripPreferences.loading) return;

    setSnapshot(buildSnapshotFromExistingData(dna.profile));
    hydratedRef.current = true;
  }, [
    dna.loading,
    dna.profile,
    setSnapshot,
    tripPreferences.loading,
    tripPreferences.preferences,
  ]);

  const loading = dna.loading;
  const saving = dna.saving;
  const loadError = dna.error;
  const saveError = dna.saveError;
  const canAdvance = hasSelection();

  async function handleFinish() {
    setSubmitError(null);

    try {
      await dna.save(buildProfilePayload());
      next();
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message);
        return;
      }

      setSubmitError("Não foi possível salvar suas respostas agora.");
    }
  }

  if (loading) return <PlanningSkeleton steps={ONBOARDING_STEPS.length} />;

  if (loadError) return <section className="page-content"><Feedback kind="error" title="Não foi possível carregar seu DNA" description={loadError} onRetry={dna.refetch} /></section>;

  if (finished) {
    return (
      <div className="onboarding-shell">
        <OnboardingSidebar currentIndex={currentIndex} />
        <main className="flex min-w-0 flex-1 px-6 py-8 sm:px-8 lg:p-10">
          <div className="flex flex-1 items-center justify-center rounded-card border border-border bg-white px-6 py-10">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <PartyPopper
                size={52}
                strokeWidth={1.5}
                className="text-ink-muted"
              />
              <h2 className="text-4xl font-medium text-foreground">
                DNA configurado!
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Suas preferências foram salvas no perfil. Elas serão consideradas
                nas recomendações disponíveis.
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-hover"
                >
                  Ir para a home
                </Link>
                <Link
                  to="/onboard/preferências"
                  className="inline-flex h-12 items-center justify-center rounded-control border border-border px-6 text-sm font-medium text-strong transition hover:border-border hover:bg-background"
                >
                  Refinar preferências
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <div className="planning-page">
    <div className="planning-context"><span className="planning-destination">DNA do viajante</span><Link to="/perfil" className="planning-exit">Sair</Link></div>
    <div className="planning-layout">
      <PlanningSteps title="Seu DNA" steps={ONBOARDING_STEPS} currentIndex={currentIndex} fieldValues={fieldValues} tagValues={tagValues} cardSelections={cardSelections} onSelect={setCurrentStep} />
      <section className="planning-content"><div className="planning-scroll min-h-0 overflow-y-auto" tabIndex={0} aria-label="Conteúdo da etapa">
        <StepTransition step={currentIndex}><header className="planning-heading"><p className="text-xs text-muted-foreground">{currentStep.label} · Etapa {currentIndex + 1} de {ONBOARDING_STEPS.length}</p><h1 ref={headingRef} tabIndex={-1}>{currentStep.title.endsWith("?") ? currentStep.title : `${currentStep.title}?`}</h1><p className="text-sm text-muted-foreground">{currentStep.sub}</p></header>
        <div className="planning-controls planning-step-card"><OnboardingStepFields currentStep={currentStep} selectedCards={selectedCards} fieldValues={fieldValues} tagValues={tagValues} onToggleCard={toggleCard} onSetField={setField} onSetTags={setTags} prefilled={!!dna.profile} /></div>
        {(submitError || saveError) && <p role="alert" className="planning-notice text-sm">{submitError || saveError}</p>}
        {!canAdvance && <p id="planning-required" className="text-xs text-muted-foreground">{currentStep.key === "timing" ? "Escolha datas válidas (até 60 dias) ou informe duração e mês para continuar." : "Preencha os campos obrigatórios ou selecione uma opção para continuar."}</p>}
        </StepTransition></div><footer className="planning-footer">{currentIndex > 0 && <Button variant="ghost" onClick={prev} disabled={saving}>Voltar</Button>}{!isLast && currentStep.key !== "conta" && <Button variant="ghost" onClick={skip} disabled={saving}>Pular essa etapa</Button>}<Button onClick={isLast ? handleFinish : next} loading={saving} disabled={!canAdvance} aria-describedby={!canAdvance ? "planning-required" : undefined}>{isLast ? "Concluir configuração" : "Continuar"}</Button></footer>
      </section>
    </div>
  </div>;
}
