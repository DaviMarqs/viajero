import { AlertCircle, Loader2, PartyPopper } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import OnboardingSidebar from "../../components/ui/onboarding-sidebar";
import OnboardingStepFields from "@/components/ui/onboarding-step-fields";
import { useOnboarding, type OnboardingSnapshot } from "../../hooks/useOnboarding";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import { useTripPreferences } from "@/hooks/useTripPreferences";
import { useAuth } from "@/contexts/authContext";
import { ONBOARDING_STEPS } from "./onboarding.data";
import type { TravelerDNAProfile, UserTripPreference } from "@/lib/profiles";

interface TravelerDNANotes {
  companionship?: string;
  additional_preferences?: string[];
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

function formatMoneyToInput(value: string | number) {
  const normalized = Number.parseFloat(String(value));
  if (!Number.isFinite(normalized)) return "";
  return String(Math.round(normalized * 100));
}

function parseTravelerNotes(raw: string): TravelerDNANotes {
  try {
    const parsed = JSON.parse(raw) as TravelerDNANotes;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function buildSnapshotFromExistingData(
  profile: TravelerDNAProfile | null,
  preferences: UserTripPreference | null,
): OnboardingSnapshot {
  const parsedNotes = profile?.notes ? parseTravelerNotes(profile.notes) : {};
  const selectedExperiences = Array.isArray(preferences?.metadata?.selected_experiences)
    ? preferences?.metadata?.selected_experiences
    : [];
  const additionalPreferences = Array.isArray(preferences?.metadata?.additional_preferences)
    ? preferences?.metadata?.additional_preferences
    : parsedNotes.additional_preferences ?? [];
  const restrictions =
    preferences?.metadata?.restrictions ||
    (preferences?.dietary_preferences?.[0] ?? preferences?.accessibility_needs?.[0] ?? "none");

  return {
    fieldValues: {
      budget: preferences ? formatMoneyToInput(preferences.budget_max) : "",
      trip_length: preferences ? String(preferences.preferred_trip_length_days) : "",
      restrictions: typeof restrictions === "string" ? restrictions : "none",
      notes: typeof preferences?.metadata?.notes === "string" ? preferences.metadata.notes : "",
    },
    tagValues: {
      destination_types: Array.isArray(preferences?.metadata?.destination_types)
        ? preferences?.metadata?.destination_types
        : [],
      climate: Array.isArray(preferences?.metadata?.climate) ? preferences?.metadata?.climate : [],
      interests: preferences?.interests ?? [],
    },
    cardSelections: {
      ritmo: profile?.pace ? getCardIndexes("ritmo", [profile.pace]) : [],
      experiencia: getCardIndexes("experiencia", selectedExperiences),
      conforto: profile?.comfort_level ? getCardIndexes("conforto", [profile.comfort_level]) : [],
      companhia: parsedNotes.companionship ? getCardIndexes("companhia", [parsedNotes.companionship]) : [],
      adicionais: getCardIndexes("adicionais", additionalPreferences),
    },
  };
}

export default function Onboarding() {
  const { token: contextToken, isAuthenticated } = useAuth();
  const token = contextToken || localStorage.getItem("viajero.access_token") || "";
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
    next,
    skip,
    buildProfilePayload,
    buildTravelPayload,
  } = useOnboarding();
  const dna = useTravelerDNAProfile(token);
  const tripPreferences = useTripPreferences(token);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (dna.loading || tripPreferences.loading) return;

    setSnapshot(buildSnapshotFromExistingData(dna.profile, tripPreferences.preferences));
    hydratedRef.current = true;
  }, [dna.loading, dna.profile, setSnapshot, tripPreferences.loading, tripPreferences.preferences]);

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  const loading = dna.loading || tripPreferences.loading;
  const saving = dna.saving || tripPreferences.saving;
  const loadError = dna.error || tripPreferences.error;
  const saveError = dna.saveError || tripPreferences.saveError;
  const canAdvance = hasSelection();

  async function handleFinish() {
    const travelPayload = buildTravelPayload();

    if (!travelPayload.budget_max || !travelPayload.preferred_trip_length_days) {
      setSubmitError("Preencha orcamento e duracao da viagem antes de concluir.");
      return;
    }

    if (travelPayload.budget_min > travelPayload.budget_max) {
      setSubmitError("O valor minimo nao pode ser maior que o valor maximo.");
      return;
    }

    setSubmitError(null);
    try {
      await Promise.all([
        dna.save(buildProfilePayload()),
        tripPreferences.save(travelPayload),
      ]);
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
      <div className="min-h-screen bg-slate-50 lg:flex">
        <OnboardingSidebar currentIndex={currentIndex} />
        <main className="flex flex-1 px-6 py-8 sm:px-8 lg:p-10">
          <div className="flex flex-1 items-center justify-center rounded-[32px] bg-white px-6 py-10 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <PartyPopper size={52} strokeWidth={1.5} className="text-sky-500" />
              <h2 className="text-4xl font-semibold text-slate-950">DNA configurado!</h2>
              <p className="text-base leading-7 text-slate-500">
                Suas preferencias foram salvas. A IA do Viajero ja pode montar roteiros personalizados para voce.
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Ir para a home
                </Link>
                <Link
                  to="/onboard/preferencias"
                  className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-200 px-6 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Refinar preferencias
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
    <div className="min-h-screen bg-slate-50 lg:flex">
      <OnboardingSidebar currentIndex={currentIndex} />

      <main className="flex flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:p-10">
        <div className="flex w-full flex-col rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
          <header className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{currentStep.title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{currentStep.sub}</p>
            {hasCards && currentStep.fields.some((field) => field.type === "cards" && field.multi) && (
              <span className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
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

          <footer className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              onClick={isLast ? handleFinish : next}
              disabled={!canAdvance || saving}
            >
              {saving ? "Salvando..." : isLast ? "Concluir configuracao" : "Proximo"}
            </button>

            {!isLast && currentStep.key !== "conta" && (
              <button
                type="button"
                className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
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
