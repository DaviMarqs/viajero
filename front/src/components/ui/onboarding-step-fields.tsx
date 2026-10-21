import { PlanningCurrency } from "./planning-currency";
import CardOnboard from "./card-onboard";
import { CalendarCheck, CalendarRange } from "lucide-react";
import InputCurrency from "./input-currency";
import InputDropdown from "./input-dropdown";
import TagSelector from "./tag-selector";
import InputTextarea from "./input-text-area";
import type { FieldValues, TagValues } from "@/hooks/useOnboarding";
import type {
  StepField,
  OnboardingStep,
} from "@/pages/onboarding/onboarding.data";

interface OnboardingStepFieldsProps {
  currentStep: OnboardingStep;
  selectedCards?: Set<number>;
  fieldValues: FieldValues;
  tagValues?: TagValues;
  onToggleCard?: (cardIndex: number) => void;
  onSetField: (key: string, value: string) => void;
  onSetTags?: (key: string, values: string[]) => void;
  prefilled?: boolean;
  fieldErrors?: Record<string, string | undefined>;
}

export default function OnboardingStepFields({
  currentStep,
  selectedCards = new Set(),
  fieldValues,
  tagValues = {},
  onToggleCard,
  onSetField,
  onSetTags,
  prefilled = false,
  fieldErrors = {},
}: OnboardingStepFieldsProps) {
  const renderField = (field: StepField, index: number) => {
    if (field.type === "empty") return null;

    if (field.type === "cards") {
      const fieldKey =
        "key" in field && field.key ? field.key : currentStep.key;
      const selectedValue = fieldValues[fieldKey];

      return (
        <div key={`${fieldKey}-${index}`} className={currentStep.key === "timing" ? "planning-period-options" : "flex flex-col gap-3"} role={field.multi ? "group" : "radiogroup"} aria-label={currentStep.label} onKeyDown={event => {
          if (field.multi || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
          const active = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = buttons[(active + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length];
          next?.focus(); next?.click();
        }}>
          {field.cards.map((card, cardIndex) => ({ card, cardIndex })).sort((a, b) => currentStep.key === "timing" ? Number(a.card.value === "true") - Number(b.card.value === "true") : 0).map(({ card, cardIndex }) => {
            const cardValue = String(card.value);

            const isSelected =
              selectedValue !== undefined
                ? selectedValue === cardValue
                : selectedCards.has(cardIndex);

            return (
              <CardOnboard
                key={cardValue}
                icon={currentStep.key === "timing" ? card.value === "false" ? CalendarCheck : CalendarRange : card.icon}
                cardTitle={card.title}
                cardDescription={currentStep.key === "timing" ? "" : card.desc}
                selected={isSelected}
                radio={!field.multi}
                tabIndex={field.multi || isSelected || (selectedValue === undefined && selectedCards.size === 0 && cardIndex === (currentStep.key === "timing" ? 1 : 0)) ? 0 : -1}
                onClick={() => {
                  onSetField(fieldKey, cardValue);
                  onToggleCard?.(cardIndex);
                }}
              />
            );
          })}
        </div>
      );
    }

    if (field.type === "range") {
      const value = fieldValues[field.key] ?? String(field.min);

      return (
        <div key={field.key} className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor={field.key} className="text-sm font-medium text-strong">
              {field.label}
              {!field.required && <span className="text-ink-muted"> (opcional)</span>}
            </label>

            <span className="planning-data px-3 py-1 text-sm font-medium text-ink-muted">
              {value}
            </span>
          </div>

          <input
            id={field.key}
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value}
            onChange={(event) => onSetField(field.key, event.target.value)}
            className="w-full accent-primary"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{field.min}
            </span>
            <span>{field.max}
            </span>
          </div>

          {field.hint && (
            <p className="field-support">{field.hint}
            </p>
          )}
        </div>
      );
    }

    if (field.type === "currency") {
      return (
        <InputCurrency
          key={field.key}
          label={field.label}
          currency={fieldValues.currency_code || "BRL"}
          error={fieldErrors[field.key]}
          hint={field.hint}
          required={field.required}
          value={fieldValues[field.key] ?? ""}
          onChange={(value: string) => onSetField(field.key, value)}
        />
      );
    }

    if (field.type === "dropdown" && field.key === "currency_code") return <div key={field.key} className="space-y-2"><p className="text-sm font-medium">{field.label}{!field.required && " (opcional)"}</p><PlanningCurrency value={fieldValues[field.key] ?? ""} onChange={value => onSetField(field.key, value)} /></div>;

    if (field.type === "dropdown") {
      return (
        <InputDropdown
          key={field.key}
          label={field.label}
          hint={field.hint}
          required={field.required}
          icon={field.icon as "none" | "calendar" | undefined}
          options={field.options}
          value={fieldValues[field.key] ?? ""}
          onChange={(value: string) => onSetField(field.key, value)}
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
          onChange={(values: string[]) => onSetTags?.(field.key, values)}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <InputTextarea
          key={field.key}
          label={field.label}
          hint={field.hint}
          placeholder={field.placeholder}
          value={fieldValues[field.key] ?? ""}
          onChange={(value: string) => onSetField(field.key, value)}
        />
      );
    }

    return null;
  };

  return (
    <div className={currentStep.key === "budget" ? "planning-budget-fields" : "planning-fields"}>{[...currentStep.fields].sort((a, b) => currentStep.key === "timing" ? Number(b.type === "cards") - Number(a.type === "cards") : currentStep.key === "budget" ? Number(b.type === "dropdown") - Number(a.type === "dropdown") : 0).map((field, index) => <div key={"key" in field ? field.key : `${field.type}-${index}`} className={`planning-field ${field.type === "dropdown" && field.key === "currency_code" ? "planning-currency-field" : ""}`}>{prefilled && (field.type === "cards" ? selectedCards.size > 0 : field.type === "tags" ? !!tagValues[field.key]?.length : "key" in field && !!fieldValues[field.key]) && <p className="planning-prefilled">Pré-preenchido com suas últimas preferências</p>}{renderField(field, index)}</div>)}</div>
  );
}
