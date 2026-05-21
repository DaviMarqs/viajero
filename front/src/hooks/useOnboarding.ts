import { useState, useCallback } from "react";
import { ONBOARDING_STEPS } from "../pages/onboarding/onboarding.data";

// ── Tipos de estado ───────────────────────────────────────────

export type CardSelections = Record<string, Set<number>>;
export type FieldValues = Record<string, string>;
export type TagValues = Record<string, string[]>;

// ── Mapeamentos DNA → campos numéricos ────────────────────────

const PACE_MAP: Record<string, number> = { adventure: 9, balanced: 5, relaxed: 2 };
const ADVENTURE_MAP: Record<string, number> = { adventure: 9, balanced: 5, relaxed: 2 };
const SOCIAL_ENERGY_MAP: Record<string, number> = { solo: 2, couple: 4, friends: 8, family: 6 };
const HOTEL_MAP: Record<string, string> = { budget: "lodging", standard: "lodging", premium: "lodging" };

// ── Shapes dos payloads ───────────────────────────────────────

export interface ProfilePayload {
  travel_style: string;
  pace: number;
  comfort_level: string;
  social_energy: number;
  adventure_level: number;
  food_focus: number;
  cultural_interest: number;
  nature_interest: number;
  nightlife_interest: number;
  accessibility_needs: string[];
  interests: string[];
}

export interface TravelPayload {
  budget_min: number;
  budget_max: number;
  currency_code: string;
  preferred_trip_length_days: number;
  hotel_level: string;
  destination_types: string[];
  climate: string[];
  interests: string[];
  dietary_preferences: string[];
  accessibility_needs: string[];
  notes: string;
}

// ── Hook ──────────────────────────────────────────────────────

export function useOnboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cards (índices selecionados por step key)
  const [cardSelections, setCardSelections] = useState<CardSelections>({});

  // Campos livres: currency, dropdown, textarea (valor string por field key)
  const [fieldValues, setFieldValues] = useState<FieldValues>({});

  // Tags (array de values por field key)
  const [tagValues, setTagValues] = useState<TagValues>({});

  const [finished, setFinished] = useState(false);

  const currentStep = ONBOARDING_STEPS[currentIndex];
  const isLast = currentIndex === ONBOARDING_STEPS.length - 1;

  // ── Seleção atual de cards ──────────────────────────────────
  const selectedCards = cardSelections[currentStep.key] ?? new Set<number>();

  // ── Verifica se o step atual tem algo preenchido ────────────
  const hasSelection = useCallback((): boolean => {
    for (const field of currentStep.fields) {
      if (field.type === "empty") return true;

      if (field.type === "cards") {
        const sel = cardSelections[currentStep.key];
        if (!sel || sel.size === 0) return false;
      }

      if (field.type === "currency" || field.type === "dropdown") {
        if (field.required && !fieldValues[field.key]) return false;
      }

      if (field.type === "tags") {
        if (field.required) {
          const sel = tagValues[field.key];
          if (!sel || sel.length === 0) return false;
        }
      }
    }
    return true;
  }, [currentStep, cardSelections, fieldValues, tagValues]);

  // ── Toggle de card ──────────────────────────────────────────
  const toggleCard = useCallback(
    (cardIndex: number) => {
      const field = currentStep.fields.find((f) => f.type === "cards");
      const isMulti = field?.type === "cards" && field.multi;

      setCardSelections((prev) => {
        const key = currentStep.key;
        const current = new Set(prev[key] ?? []);
        if (isMulti) {
          if (current.has(cardIndex)) current.delete(cardIndex);
          else current.add(cardIndex);
        } else {
          current.clear();
          current.add(cardIndex);
        }
        return { ...prev, [key]: current };
      });
    },
    [currentStep]
  );

  const setField = useCallback((key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setTags = useCallback((key: string, values: string[]) => {
    setTagValues((prev) => ({ ...prev, [key]: values }));
  }, []);

  const next = useCallback(() => {
    if (isLast) setFinished(true);
    else setCurrentIndex((i) => i + 1);
  }, [isLast]);

  const skip = useCallback(() => {
    if (!isLast) setCurrentIndex((i) => i + 1);
  }, [isLast]);

  const getCardValues = useCallback(
    (key: string): string[] => {
      const step = ONBOARDING_STEPS.find((s) => s.key === key);
      const sel = cardSelections[key];
      if (!step || !sel) return [];
      const field = step.fields.find((f) => f.type === "cards");
      if (!field || field.type !== "cards") return [];
      return Array.from(sel).map((i) => String(field.cards[i].value));
    },
    [cardSelections]
  );

  const buildProfilePayload = useCallback((): ProfilePayload => {
    const [ritmo] = getCardValues("ritmo");
    const experiencias = getCardValues("experiencia");
    const [conforto] = getCardValues("conforto");
    const [companhia] = getCardValues("companhia");
    const adicionais = getCardValues("adicionais");
    const hasExp = (v: string) => experiencias.includes(v);

    return {
      travel_style: ritmo ?? "balanced",
      pace: PACE_MAP[ritmo] ?? 5,
      comfort_level: conforto ?? "standard",
      social_energy: SOCIAL_ENERGY_MAP[companhia] ?? 5,
      adventure_level: hasExp("nature_adventure") ? 8 : ADVENTURE_MAP[ritmo] ?? 5,
      food_focus: hasExp("food_culture") ? 8 : 3,
      cultural_interest: hasExp("food_culture") ? 8 : 3,
      nature_interest: hasExp("nature_adventure") ? 8 : 3,
      nightlife_interest: hasExp("nightlife") ? 8 : 2,
      accessibility_needs: adicionais.includes("accessibility") ? ["mobility"] : [],
      interests: adicionais.filter((v) => v !== "accessibility"),
    };
  }, [getCardValues]);

  const buildTravelPayload = useCallback((): TravelPayload => {
    const [conforto] = getCardValues("conforto");
    const budgetRaw = parseInt(fieldValues["budget"] ?? "0", 10) / 100;
    const tripLength = parseInt(fieldValues["trip_length"] ?? "7", 10);
    const destinationTypes = tagValues["destination_types"] ?? [];
    const climate = tagValues["climate"] ?? [];
    const interests = tagValues["interests"] ?? [];
    const restrictions = fieldValues["restrictions"] ?? "none";
    const notes = fieldValues["notes"] ?? "";

    const dietaryRestrictions = ["vegetarian", "vegan", "food_allergy"].includes(restrictions)
      ? [restrictions]
      : [];

    const accessibilityNeeds = restrictions === "mobility" ? ["mobility"] : [];

    return {
      budget_min: Math.round(budgetRaw * 0.8),
      budget_max: budgetRaw,
      currency_code: "BRL",
      preferred_trip_length_days: tripLength,
      hotel_level: HOTEL_MAP[conforto] ?? "hotel",
      destination_types: destinationTypes,
      climate: climate,
      interests: interests,
      dietary_preferences: dietaryRestrictions,
      accessibility_needs: accessibilityNeeds,
      notes: notes,
    };
  }, [getCardValues, fieldValues, tagValues]);

  return {
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
  };
}