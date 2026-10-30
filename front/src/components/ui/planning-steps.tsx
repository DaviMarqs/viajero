import { Sheet } from "@/components/motion/sheet";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { displayTripDate, tripDuration } from "@/lib/trip-dates";
import type { OnboardingStep } from "@/pages/onboarding/onboarding.data";
import type { FieldValues, TagValues } from "@/hooks/useOnboarding";

export function PlanningSteps({ steps, currentIndex, fieldValues, tagValues, cardSelections, onSelect, title = "Sua viagem" }: { steps: OnboardingStep[]; currentIndex: number; fieldValues: FieldValues; tagValues: TagValues; cardSelections: Record<string, number[]>; onSelect: (index: number) => void; title?: string }) {
  const stepperId = useId();
  const [open, setOpen] = useState(false);
  const selectedStep = useRef(false);
  const previous = useRef(currentIndex);
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (currentIndex > previous.current) document.querySelectorAll(`[data-stepper="${stepperId}"][data-step-index="${previous.current}"] svg`).forEach(icon => icon.classList.add("motion-step-check"));
    previous.current = currentIndex;
  }, [currentIndex, stepperId]);
  function summary(step: OnboardingStep) {
    if (step.key === "budget" && fieldValues.budget_min && fieldValues.budget_max) { const format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }); const symbol = new Intl.NumberFormat("pt-BR", { style: "currency", currency: fieldValues.currency_code || "BRL" }).formatToParts(0).find(part => part.type === "currency")?.value; return `${symbol} ${format.format(Number(fieldValues.budget_min) / 100)} – ${format.format(Number(fieldValues.budget_max) / 100)}`; }
    if (step.key === "timing" && fieldValues.start_date && cardSelections.timing?.includes(1)) return `${displayTripDate(fieldValues.start_date)} → ${displayTripDate(fieldValues.end_date)} · ${tripDuration(fieldValues.start_date, fieldValues.end_date) ?? "—"} dias`;
    return step.fields.flatMap(field => {
      if (field.type === "cards") return (cardSelections[step.key] ?? []).map(index => field.cards[index]?.title).filter(Boolean);
      if (field.type === "tags") return (tagValues[field.key] ?? []).map(value => field.options.find(option => option.value === value)?.label ?? value);
      if (field.type === "dropdown" && field.key === "currency_code") return [];
      if (field.type === "dropdown") return field.options.find(option => option.value === fieldValues[field.key])?.label ?? [];
      if (field.type === "range") return fieldValues[field.key] ? `${field.label}: ${fieldValues[field.key]}` : [];
      if (field.type === "textarea") return fieldValues[field.key] ?? [];
      if (field.type === "currency") { const raw = fieldValues[field.key]; return raw ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: fieldValues.currency_code || "BRL" }).format(Number(raw) / 100) : []; }
      return [];
    }).join(" · ") || "Nenhuma preferência informada";
  }
  const navigation = <nav aria-label="Etapas da configuração">{steps.map((step, index) => <button type="button" key={step.key} className="planning-step" data-step-index={index} data-stepper={stepperId} aria-current={index === currentIndex ? "step" : undefined} disabled={index >= currentIndex} onClick={() => { selectedStep.current = true; onSelect(index); setOpen(false); }}><span className="planning-step-number">{index < currentIndex ? <Check size={16} strokeWidth={1.5} /> : index + 1}</span><span><span className="planning-step-label">{step.label}</span>{index <= currentIndex && <span className={`planning-step-value planning-data`}>{summary(step)}</span>}</span></button>)}</nav>;
  return <div ref={container} className="planning-navigation-wrap">
    <aside className="planning-sidebar"><h2>{title}</h2><p className="planning-step-count">Etapa {currentIndex + 1} de {steps.length}</p><progress className="planning-completion" value={currentIndex + 1} max={steps.length} aria-label={`Etapa ${currentIndex + 1} de ${steps.length}`} />{navigation}</aside>
    <Sheet open={open} onOpenChange={setOpen} title={title} onCloseAutoFocus={event => { if (selectedStep.current) { event.preventDefault(); selectedStep.current = false; } }} trigger={<button type="button" className="planning-mobile-progress"><span>{steps[currentIndex].label} · {currentIndex + 1} de {steps.length}</span><ChevronDown size={16} /><span className="planning-segments" aria-hidden>{steps.map((step, index) => <i key={step.key} data-complete={index <= currentIndex} />)}</span></button>}>{navigation}</Sheet>
  </div>;
}
