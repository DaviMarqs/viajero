import CardOnboard from "./card-onboard";
import InputCurrency from "./input-currency";
import TagSelector from "./tag-selector";
import InputTextarea from "./input-text-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
            <label className="text-sm font-medium text-neutral-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
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
            className="w-full accent-blue-600"
          />

          <div className="flex justify-between text-xs text-neutral-400">
            <span>{field.min}</span>
            <span>{field.max}</span>
          </div>

          {field.hint && (
            <p className="text-sm leading-6 text-neutral-500">{field.hint}</p>
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
        <div key={field.key} className="space-y-3">
          {field.label && (
            <label className="text-sm font-medium text-neutral-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
          )}
          <Select
            value={fieldValues[field.key] ?? ""}
            onValueChange={(value: string) => onSetField(field.key, value)}
          >
            <SelectTrigger className="h-14 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 transition hover:bg-neutral-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 data-[state=open]:border-blue-500">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-neutral-100 bg-white shadow-lg">
              {field.options?.map((option) => (
                <SelectItem
                  key={option.value}
                  value={String(option.value)}
                  className="cursor-pointer rounded-lg px-4 py-3 text-sm text-neutral-700 transition focus:bg-blue-50 focus:text-blue-900"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.hint && (
            <p className="text-sm leading-6 text-neutral-500">{field.hint}</p>
          )}
        </div>
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