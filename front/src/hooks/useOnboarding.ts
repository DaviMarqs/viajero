import { useCallback, useState } from "react";
import { ONBOARDING_STEPS, type OnboardingStep } from "../pages/onboarding/onboarding.data";

export type CardSelections = Record<string, Set<number>>;
export type FieldValues = Record<string, string>;
export type TagValues = Record<string, string[]>;

export interface OnboardingSnapshot {
  currentIndex?: number;
  cardSelections?: Record<string, number[]>;
  fieldValues?: FieldValues;
  tagValues?: TagValues;
}

const PACE_MAP: Record<string, number> = { adventure: 9, balanced: 5, relaxed: 2 };
const ADVENTURE_MAP: Record<string, number> = { adventure: 9, balanced: 5, relaxed: 2 };
const SOCIAL_ENERGY_MAP: Record<string, number> = { solo: 2, couple: 4, friends: 8, family: 6 };
const HOTEL_MAP: Record<string, string> = { budget: "budget", standard: "mid", premium: "luxury" };
const TRANSPORTATION_MAP: Record<string, string> = { budget: "public", standard: "mixed", premium: "private" };

export interface ProfilePayload {
  travel_style: string;
  pace: string;
  comfort_level: string;
  social_energy: number;
  adventure_level: number;
  food_focus: number;
  cultural_interest: number;
  nature_interest: number;
  nightlife_interest: number;
  notes: string;
}

export interface TravelPayload {
  budget_min: number;
  budget_max: number;
  currency_code: string;
  preferred_trip_length_days: number;
  travel_month: string;
  hotel_level: string;
  transportation_style: string;
  dietary_preferences: string[];
  accessibility_needs: string[];
  interests: string[];
  metadata: Record<string, unknown>;
}

interface TravelerDNANotes {
  companionship?: string;
  additional_preferences?: string[];
}

export function useOnboarding(steps: OnboardingStep[] = ONBOARDING_STEPS) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardSelections, setCardSelections] = useState<CardSelections>({});
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [tagValues, setTagValues] = useState<TagValues>({});
  const [finished, setFinished] = useState(false);

  const currentStep = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;
  const selectedCards = cardSelections[currentStep.key] ?? new Set<number>();

  const hasSelection = useCallback((): boolean => {
    for (const field of currentStep.fields) {
      if (field.type === "empty") return true;

      if (field.type === "cards") {
        const selected = cardSelections[currentStep.key];
        if (!selected || selected.size === 0) return false;
      }

      if ((field.type === "currency" || field.type === "dropdown") && field.required && !fieldValues[field.key]) {
        return false;
      }

      if (field.type === "tags" && field.required) {
        const selected = tagValues[field.key];
        if (!selected || selected.length === 0) return false;
      }
    }

    return true;
  }, [cardSelections, currentStep, fieldValues, tagValues]);

  const toggleCard = useCallback(
    (cardIndex: number) => {
      const field = currentStep.fields.find((item) => item.type === "cards");
      const isMulti = field?.type === "cards" && field.multi;

      setCardSelections((previous) => {
        const current = new Set(previous[currentStep.key] ?? []);

        if (isMulti) {
          if (current.has(cardIndex)) current.delete(cardIndex);
          else current.add(cardIndex);
        } else {
          current.clear();
          current.add(cardIndex);
        }

        return { ...previous, [currentStep.key]: current };
      });
    },
    [currentStep],
  );

  const setField = useCallback((key: string, value: string) => {
    setFieldValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const setTags = useCallback((key: string, values: string[]) => {
    setTagValues((previous) => ({ ...previous, [key]: values }));
  }, []);

  const setSnapshot = useCallback((snapshot: OnboardingSnapshot) => {
    if (typeof snapshot.currentIndex === "number") {
      setCurrentIndex(snapshot.currentIndex);
    }

    if (snapshot.cardSelections) {
      const nextSelections = Object.fromEntries(
        Object.entries(snapshot.cardSelections).map(([key, values]) => [key, new Set(values)]),
      ) as CardSelections;
      setCardSelections(nextSelections);
    }

    if (snapshot.fieldValues) {
      setFieldValues(snapshot.fieldValues);
    }

    if (snapshot.tagValues) {
      setTagValues(snapshot.tagValues);
    }
  }, []);

  const next = useCallback(() => {
    if (isLast) setFinished(true);
    else setCurrentIndex((index) => index + 1);
  }, [isLast]);

  const skip = useCallback(() => {
    if (!isLast) setCurrentIndex((index) => index + 1);
  }, [isLast]);

  const getCardValues = useCallback(
    (key: string): string[] => {
      const step = steps.find((item) => item.key === key);
      const selected = cardSelections[key];
      if (!step || !selected) return [];

      const field = step.fields.find((item) => item.type === "cards");
      if (!field || field.type !== "cards") return [];

      return Array.from(selected).map((index) => String(field.cards[index].value));
    },
    [cardSelections, steps],
  );

  const buildProfilePayload = useCallback((): ProfilePayload => {
    const [ritmo] = getCardValues("ritmo");
    const experiencias = getCardValues("experiencia");
    const [conforto] = getCardValues("conforto");
    const [companhia] = getCardValues("companhia");
    const adicionais = getCardValues("adicionais");
    const hasExperience = (value: string) => experiencias.includes(value);

    const notes: TravelerDNANotes = {
      companionship: companhia,
      additional_preferences: adicionais,
    };

    return {
      travel_style: experiencias.join(",") || ritmo || "balanced",
      pace: ritmo ?? "balanced",
      comfort_level: conforto ?? "standard",
      social_energy: SOCIAL_ENERGY_MAP[companhia] ?? 5,
      adventure_level: hasExperience("nature_adventure") ? 8 : ADVENTURE_MAP[ritmo] ?? 5,
      food_focus: hasExperience("food_culture") ? 8 : 3,
      cultural_interest: hasExperience("food_culture") ? 8 : 3,
      nature_interest: hasExperience("nature_adventure") ? 8 : 3,
      nightlife_interest: hasExperience("nightlife") ? 8 : 2,
      notes: JSON.stringify(notes),
    };
  }, [getCardValues]);

  const buildTravelPayload = useCallback((): TravelPayload => {
    const [conforto] = getCardValues("conforto");
    const experiencias = getCardValues("experiencia");
    const adicionais = getCardValues("adicionais");
    const budgetRaw = parseInt(fieldValues.budget ?? "0", 10) / 100;
    const tripLength = parseInt(fieldValues.trip_length ?? "7", 10);
    const destinationTypes = tagValues.destination_types ?? [];
    const climate = tagValues.climate ?? [];
    const interests = tagValues.interests ?? [];
    const restrictions = fieldValues.restrictions ?? "none";
    const notes = fieldValues.notes ?? "";

    const dietaryRestrictions = ["vegetarian", "vegan", "food_allergy"].includes(restrictions)
      ? [restrictions]
      : [];

    const accessibilityNeeds = Array.from(
      new Set([
        ...(restrictions === "mobility" ? ["mobility"] : []),
        ...(adicionais.includes("accessibility") ? ["mobility"] : []),
      ]),
    );

    return {
      budget_min: Math.round(budgetRaw * 0.8),
      budget_max: budgetRaw,
      currency_code: "BRL",
      preferred_trip_length_days: tripLength,
      travel_month: "",
      hotel_level: HOTEL_MAP[conforto] ?? "mid",
      transportation_style: TRANSPORTATION_MAP[conforto] ?? "mixed",
      dietary_preferences: dietaryRestrictions,
      accessibility_needs: accessibilityNeeds,
      interests,
      metadata: {
        climate,
        destination_types: destinationTypes,
        notes,
        selected_experiences: experiencias,
        additional_preferences: adicionais,
        restrictions,
      },
    };
  }, [fieldValues, getCardValues, tagValues]);

  return {
    steps,
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
    getCardValues,
    buildProfilePayload,
    buildTravelPayload,
  };
}
