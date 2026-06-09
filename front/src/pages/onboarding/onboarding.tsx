import { AlertCircle, Loader2, PartyPopper, ArrowLeft } from "lucide-react";
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
    const parsed = JSON.parse(rawNotes) as { text?: unknown };
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    currentIndex,
    currentStep,
    isLast,
    finished,
    selectedCards,
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

      setSubmitError("Nao foi possivel salvar suas respostas agora.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Carregando seu onboarding...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl border border-red-100 bg-white px-6 py-8 text-center">
          <AlertCircle className="size-6 text-red-500" />
          <p className="text-sm leading-6 text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-neutral-50 font-['Inter'] selection:bg-blue-100 selection:text-blue-900 lg:flex">
        <OnboardingSidebar currentIndex={currentIndex} />
        <main className="flex flex-1 px-6 py-8 sm:px-8 lg:p-12">
          <div className="flex flex-1 items-center justify-center rounded-3xl border border-neutral-200 bg-white px-6 py-10 shadow-sm">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <PartyPopper
                size={52}
                strokeWidth={1.5}
                className="text-blue-600"
              />
              <h2 className="font-['Geist'] text-4xl font-normal tracking-tight text-neutral-900">
                DNA configurado!
              </h2>
              <p className="text-base leading-relaxed text-neutral-500">
                Suas preferências foram salvas. A IA do Viajero já pode montar
                roteiros personalizados para você.
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex h-14 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Ir para a home
                </Link>
                <Link
                  to="/onboard/preferências"
                  className="inline-flex h-14 items-center justify-center rounded-xl border border-neutral-200 bg-transparent px-6 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 hover:text-neutral-900"
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

  const hasCards = currentStep.fields.some((field) => field.type === "cards");

  return (
    <div className="min-h-screen bg-neutral-50 font-['Inter'] selection:bg-blue-100 selection:text-blue-900 lg:flex">
      <OnboardingSidebar currentIndex={currentIndex} />

      <main className="flex flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:p-12">
        <div className="flex w-full flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 lg:p-12">
          <header className="flex flex-col gap-3">
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={prev}
                disabled={saving}
                className="mb-2 flex w-fit items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 disabled:opacity-50"
              >
                <ArrowLeft className="size-4" />
                Voltar
              </button>
            )}

            <h2 className="font-['Geist'] text-3xl font-normal tracking-tight text-neutral-900 md:text-4xl">
              {currentStep.title}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-500 sm:text-base">
              {currentStep.sub}
            </p>
            {hasCards &&
              currentStep.fields.some(
                (field) => field.type === "cards" && field.multi,
              ) && (
                <span className="mt-2 inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Selecione quantas quiser
                </span>
              )}
          </header>

          <div className="mt-8 flex flex-1 flex-col gap-5">
            <OnboardingStepFields
              currentStep={currentStep}
              selectedCards={selectedCards}
              fieldValues={fieldValues}
              tagValues={tagValues}
              onToggleCard={toggleCard}
              onSetField={setField}
              onSetTags={setTags}
            />
          </div>

          {(submitError || saveError) && (
            <div className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{submitError || saveError}</span>
            </div>
          )}

          <footer className="mt-8 flex flex-col gap-3 pt-6 border-t border-neutral-100">
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              onClick={isLast ? handleFinish : next}
              disabled={!canAdvance || saving}
            >
              {saving
                ? "Salvando..."
                : isLast
                  ? "Concluir configuração"
                  : "Próximo"}
            </button>

            {!isLast && currentStep.key !== "conta" && (
              <button
                type="button"
                className="flex h-14 w-full items-center justify-center rounded-xl border border-neutral-200 bg-transparent text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-50"
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
