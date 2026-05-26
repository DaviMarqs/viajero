import { useCallback, useMemo, useState } from "react";
import type { OnboardingStep } from "@/pages/onboarding/onboarding.data";

export type FieldValues = Record<string, any>;
export type TagValues = Record<string, string[]>;
type CardSelections = Record<string, number[]>;

export interface OnboardingSnapshot {
  currentIndex?: number;
  currentStep?: OnboardingStep;
  isLast?: boolean;
  finished?: boolean;
  selectedCards?: Set<number>;
  fieldValues?: FieldValues;
  tagValues?: TagValues;
  cardSelections?: CardSelections;
  hasSelection?: () => boolean;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  saveError?: string | null;
}

function toNumber(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) / 100;
}

export function useOnboarding(steps: OnboardingStep[] = []) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardSelections, setCardSelections] = useState<CardSelections>({});
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [tagValues, setTagValues] = useState<TagValues>({});
  const [finished, setFinished] = useState(false);
  const [loading] = useState(false);
  const [saving] = useState(false);
  const [error] = useState<string | null>(null);
  const [saveError] = useState<string | null>(null);

  const currentStep =
    steps[currentIndex] ??
    ({
      key: `step-${currentIndex}`,
      label: "",
      title: "",
      sub: "",
      fields: [],
    } satisfies OnboardingStep);

  const selectedCards = useMemo(
    () => new Set(cardSelections[currentStep.key] ?? []),
    [cardSelections, currentStep.key],
  );

  const isLast = steps.length > 0 && currentIndex >= steps.length - 1;

  const getCardValues = useCallback(
    (stepKey: string) => {
      const step = steps.find((item) => item.key === stepKey);
      const cardsField = step?.fields.find((item) => item.type === "cards");

      if (!step || !cardsField || cardsField.type !== "cards") {
        return [] as string[];
      }

      return (cardSelections[stepKey] ?? [])
        .map((index) => cardsField.cards[index])
        .filter(Boolean)
        .map((card) => String(card.value));
    },
    [cardSelections, steps],
  );

  const hasSelection = useCallback(() => {
    if (!currentStep.fields.length) return false;

    return currentStep.fields.some((field) => {
      if (field.type === "cards") {
        return selectedCards.size > 0;
      }

      if (field.type === "tags") {
        return (tagValues[field.key] ?? []).length > 0;
      }

      if ("key" in field) {
        const value = fieldValues[field.key];
        return value !== undefined && value !== null && String(value).trim() !== "";
      }

      return false;
    });
  }, [currentStep.fields, fieldValues, selectedCards, tagValues]);

  const toggleCard = useCallback(
    (cardIndex: number) => {
      setCardSelections((current) => {
        const cardsField = currentStep.fields.find((field) => field.type === "cards");
        const isMulti = cardsField?.type === "cards" && cardsField.multi;
        const next = new Set(current[currentStep.key] ?? []);

        if (isMulti) {
          if (next.has(cardIndex)) {
            next.delete(cardIndex);
          } else {
            next.add(cardIndex);
          }
        } else if (next.has(cardIndex)) {
          next.clear();
        } else {
          next.clear();
          next.add(cardIndex);
        }

        return {
          ...current,
          [currentStep.key]: Array.from(next),
        };
      });
    },
    [currentStep.fields, currentStep.key],
  );

  const setField = useCallback((key: string, value: any) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
  }, []);

  const setTags = useCallback((key: string, values: string[]) => {
    setTagValues((current) => ({ ...current, [key]: values }));
  }, []);

  const setSnapshot = useCallback((snapshot: Partial<OnboardingSnapshot> | null | undefined) => {
    if (!snapshot) return;
    if (typeof snapshot.currentIndex === "number") {
      setCurrentIndex(snapshot.currentIndex);
    }
    if (snapshot.fieldValues) {
      setFieldValues(snapshot.fieldValues);
    }
    if (snapshot.tagValues) {
      setTagValues(snapshot.tagValues);
    }
    if (snapshot.cardSelections) {
      setCardSelections(snapshot.cardSelections);
    }
    if (typeof snapshot.finished === "boolean") {
      setFinished(snapshot.finished);
    }
  }, []);

  const next = useCallback(() => {
    if (isLast) {
      setFinished(true);
      return;
    }

    setCurrentIndex((value) => value + 1);
  }, [isLast]);

  const skip = useCallback(() => {
    if (isLast) {
      setFinished(true);
      return;
    }

    setCurrentIndex((value) => value + 1);
  }, [isLast]);

  const buildProfilePayload = useCallback(() => {
    const companionship = getCardValues("companhia")[0] ?? "";
    const additionalPreferences = getCardValues("adicionais");

    return {
      travel_style: getCardValues("experiencia")[0] ?? "",
      pace: getCardValues("ritmo")[0] ?? "",
      comfort_level: getCardValues("conforto")[0] ?? "",
      social_energy: 0,
      adventure_level: 0,
      food_focus: 0,
      cultural_interest: 0,
      nature_interest: 0,
      nightlife_interest: 0,
      notes: JSON.stringify({
        companionship,
        additional_preferences: additionalPreferences,
      }),
    };
  }, [getCardValues]);

  const buildTravelPayload = useCallback(() => {
    const budget = toNumber(fieldValues.budget);
    const restrictions = String(fieldValues.restrictions ?? "none");

    return {
      budget_min: budget,
      budget_max: budget,
      currency_code: "BRL",
      preferred_trip_length_days: Number.parseInt(String(fieldValues.trip_length ?? "0"), 10) || 0,
      travel_month: String(fieldValues.travel_month ?? ""),
      hotel_level: getCardValues("conforto")[0] ?? "",
      transportation_style: "",
      dietary_preferences: restrictions === "vegetarian" || restrictions === "vegan" ? [restrictions] : [],
      accessibility_needs: restrictions === "mobility" ? [restrictions] : [],
      interests: tagValues.interests ?? [],
      metadata: {
        climate: tagValues.climate ?? [],
        destination_types: tagValues.destination_types ?? [],
        selected_experiences: getCardValues("experiencia"),
        additional_preferences: getCardValues("adicionais"),
        restrictions,
        notes: String(fieldValues.notes ?? ""),
      },
    };
  }, [fieldValues, getCardValues, tagValues]);

  const snapshot = useMemo(
    () => ({
      currentIndex,
      currentStep,
      isLast,
      finished,
      selectedCards,
      fieldValues,
      tagValues,
      cardSelections,
      hasSelection,
      loading,
      saving,
      error,
      saveError,
    }),
    [
      cardSelections,
      currentIndex,
      currentStep,
      error,
      fieldValues,
      finished,
      hasSelection,
      isLast,
      loading,
      saveError,
      saving,
      selectedCards,
      tagValues,
    ],
  );

  return {
    ...snapshot,
    step: currentStep,
    answers: fieldValues,
    setCurrentStep: setCurrentIndex,
    setStep: setCurrentIndex,
    nextStep: next,
    prevStep: skip,
    updateAnswers: (patch: Partial<FieldValues>) => setFieldValues((current) => ({ ...current, ...patch })),
    submit: async () => {
      setFinished(true);
      return {
        cardSelections,
        fieldValues,
        tagValues,
      };
    },
    handleSubmit: async () => {
      setFinished(true);
      return {
        cardSelections,
        fieldValues,
        tagValues,
      };
    },
    finish: async () => {
      setFinished(true);
      return {
        cardSelections,
        fieldValues,
        tagValues,
      };
    },
    refresh: async () => undefined,
    refetch: async () => undefined,
    setSnapshot,
    next,
    skip,
    toggleCard,
    setField,
    setTags,
    selectedCards,
    fieldValues,
    tagValues,
    hasSelection,
    buildProfilePayload,
    buildTravelPayload,
    getCardValues,
  };
}

export type OnboardingSnapshotState = ReturnType<typeof useOnboarding>;
