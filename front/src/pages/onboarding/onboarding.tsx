import { PartyPopper } from "lucide-react";
import { Link } from "react-router-dom";
import CardOnboard from "../../components/ui/card-onboard";
import OnboardingSidebar from "../../components/ui/OnboardingSidebar";
import InputCurrency from "../../components/ui/InputCurrency";
import InputDropdown from "../../components/ui/InputDropdown";
import TagSelector from "../../components/ui/TagSelector";
import InputTextarea from "../../components/ui/InputTextArea";
import { useOnboarding } from "../../hooks/useOnboarding";
import type { StepField } from "./onboarding.data";

export default function Onboarding() {
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
    next,
    skip,
    buildProfilePayload,
    buildTravelPayload,
  } = useOnboarding();

  const canAdvance = hasSelection();

  const handleFinish = () => {
    const profile = buildProfilePayload();
    const travel = buildTravelPayload();
    console.log("Profile payload:", JSON.stringify(profile, null, 2));
    console.log("Travel payload:", JSON.stringify(travel, null, 2));
    next();
  };

  const renderField = (field: StepField, index: number) => {
    if (field.type === "empty") return null;

    if (field.type === "cards") {
      return (
        <div key={index} className="flex flex-col gap-3">
          {field.cards.map((card, i) => (
            <CardOnboard
              key={card.title}
              icon={card.icon}
              cardTitle={card.title}
              cardDescription={card.desc}
              selected={selectedCards.has(i)}
              onClick={() => toggleCard(i)}
            />
          ))}
        </div>
      );
    }

    if (field.type === "currency") {
      return (
        <InputCurrency
          key={field.key}
          label={field.label}
          hint={field.hint}
          required={field.required}
          value={fieldValues[field.key] ?? ""}
          onChange={(v: string) => setField(field.key, v)}
        />
      );
    }

    if (field.type === "dropdown") {
      return (
        <InputDropdown
          key={field.key}
          label={field.label}
          hint={field.hint}
          required={field.required}
          icon={field.icon}
          options={field.options}
          value={fieldValues[field.key] ?? ""}
          onChange={(v: string) => setField(field.key, v)}
        />
      );
    }

    if (field.type === "tags") {
      return (
        <TagSelector
          key={field.key}
          label={field.label}
          hint={field.hint}
          required={field.required}
          multi={field.multi}
          options={field.options}
          selected={tagValues[field.key] ?? []}
          onChange={(v: string[]) => setTags(field.key, v)}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <InputTextarea
          key={field.key}
          label={field.label}
          hint={field.hint}
          required={field.required}
          placeholder={field.placeholder}
          value={fieldValues[field.key] ?? ""}
          onChange={(v: string) => setField(field.key, v)}
        />
      );
    }

    return null;
  };

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
                Suas preferencias foram salvas. A IA do Viajero ja pode montar roteiros
                personalizados para voce.
              </p>
              <Link
                to="/app"
                className="mt-2 inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Explorar destinos
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hasCards = currentStep.fields.some((f) => f.type === "cards");

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <OnboardingSidebar currentIndex={currentIndex} />

      <main className="flex flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:p-10">
        <div className="flex w-full flex-col rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
          <header className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              {currentStep.title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              {currentStep.sub}
            </p>
            {hasCards && currentStep.fields.some((f) => f.type === "cards" && f.multi) && (
              <span className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
                Selecione quantas quiser
              </span>
            )}
          </header>

          <div className="mt-8 flex flex-1 flex-col gap-5">
            {currentStep.fields.map((field, i) => renderField(field, i))}
          </div>

          <footer className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              onClick={isLast ? handleFinish : next}
              disabled={!canAdvance}
            >
              {isLast ? "Concluir configuracao" : "Proximo"}
            </button>

            {!isLast && currentStep.key !== "conta" && (
              <button
                type="button"
                className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                onClick={skip}
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
