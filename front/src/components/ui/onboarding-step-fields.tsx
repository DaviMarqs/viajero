import CardOnboard from "./card-onboard";
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
}

export default function OnboardingStepFields({
  currentStep,
  selectedCards = new Set(),
  fieldValues,
  tagValues = {},
  onToggleCard,
  onSetField,
  onSetTags,
}: OnboardingStepFieldsProps) {
  const renderField = (field: StepField, index: number) => {
    if (field.type === "empty") return null;

    if (field.type === "cards") {
      const fieldKey =
        "key" in field && field.key ? field.key : currentStep.key;
      const selectedValue = fieldValues[fieldKey];

      return (
        <div key={`${fieldKey}-${index}`} className="flex flex-col gap-3">
          {field.cards.map((card, cardIndex) => {
            const cardValue = String(card.value);

            const isSelected =
              selectedValue !== undefined
                ? selectedValue === cardValue
                : selectedCards.has(cardIndex);

            return (
              <CardOnboard
                key={cardValue}
                icon={card.icon}
                cardTitle={card.title}
                cardDescription={card.desc}
                selected={isSelected}
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
            <label className="text-sm font-medium text-slate-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>

            <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
              {value}
            </span>
          </div>

          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value}
            onChange={(event) => onSetField(field.key, event.target.value)}
            className="w-full accent-sky-500"
          />

          <div className="flex justify-between text-xs text-slate-400">
            <span>{field.min}</span>
            <span>{field.max}</span>
          </div>

          {field.hint && (
            <p className="text-sm leading-6 text-slate-500">{field.hint}</p>
          )}
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
          onChange={(value: string) => onSetField(field.key, value)}
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
    <>{currentStep.fields.map((field, index) => renderField(field, index))}</>
  );
}
