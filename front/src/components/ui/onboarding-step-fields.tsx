import CardOnboard from "./card-onboard";
import InputCurrency from "./input-currency";
import InputDropdown from "./input-dropdown";
import TagSelector from "./tag-selector";
import InputTextarea from "./input-text-area";
import type { FieldValues, TagValues } from "@/hooks/useOnboarding";
import type { StepField, OnboardingStep } from "@/pages/onboarding/onboarding.data";

interface OnboardingStepFieldsProps {
  currentStep: OnboardingStep;
  selectedCards: Set<number>;
  fieldValues: FieldValues;
  tagValues: TagValues;
  onToggleCard: (cardIndex: number) => void;
  onSetField: (key: string, value: string) => void;
  onSetTags: (key: string, values: string[]) => void;
}

export default function OnboardingStepFields({
  currentStep,
  selectedCards,
  fieldValues,
  tagValues,
  onToggleCard,
  onSetField,
  onSetTags,
}: OnboardingStepFieldsProps) {
  const renderField = (field: StepField, index: number) => {
    if (field.type === "empty") return null;

    if (field.type === "cards") {
      return (
        <div key={index} className="flex flex-col gap-3">
          {field.cards.map((card, cardIndex) => (
            <CardOnboard
              key={card.title}
              icon={card.icon}
              cardTitle={card.title}
              cardDescription={card.desc}
              selected={selectedCards.has(cardIndex)}
              onClick={() => onToggleCard(cardIndex)}
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
          icon={field.icon}
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
          onChange={(value: string[]) => onSetTags(field.key, value)}
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
          onChange={(value: string) => onSetField(field.key, value)}
        />
      );
    }

    return null;
  };

  return <>{currentStep.fields.map((field, index) => renderField(field, index))}</>;
}
