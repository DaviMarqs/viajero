import type { Destination } from "@/types/travel";
import type { TripPreferenceUpsertInput } from "./profiles";
import type { OnboardingSnapshot } from "@/hooks/useOnboarding";

export interface PlanningDraft { destination?: Destination; tripPreferences?: TripPreferenceUpsertInput; snapshot?: OnboardingSnapshot; }
const MAX_AGE = 30 * 86400000;
export const planningDraftKey = (userId: number | string) => `viajero:planning:v1:${userId}`;
export function readPlanningDraft(userId?: number | string): PlanningDraft | null {
  if (userId == null) return null;
  try {
    const record = JSON.parse(localStorage.getItem(planningDraftKey(userId)) ?? "null");
    if (record?.version !== 1 || !Number.isFinite(record.updatedAt) || Date.now() - record.updatedAt > MAX_AGE || !record.value || typeof record.value !== "object") return null;
    const value = record.value as PlanningDraft;
    if (value.destination && (value.destination.id == null || typeof value.destination.name !== "string")) return null;
    if (value.snapshot && (!value.snapshot.fieldValues || !value.snapshot.cardSelections || !value.snapshot.tagValues || !Number.isInteger(value.snapshot.currentIndex) || Number(value.snapshot.currentIndex) < 0 || Number(value.snapshot.currentIndex) > 6)) return null;
    if (value.snapshot && (!Object.values(value.snapshot.fieldValues ?? {}).every(field => typeof field === "string") || !Object.values(value.snapshot.tagValues ?? {}).every(tags => Array.isArray(tags) && tags.every(tag => typeof tag === "string")) || !Object.values(value.snapshot.cardSelections ?? {}).every(cards => Array.isArray(cards) && cards.every(index => Number.isInteger(index) && index >= 0 && index <= 10)))) return null;
    if (value.tripPreferences && (typeof value.tripPreferences.currency_code !== "string" || !/^[A-Z]{3}$/.test(value.tripPreferences.currency_code) || !Array.isArray(value.tripPreferences.interests) || !value.tripPreferences.metadata)) return null;
    return value;
  } catch { return null; }
}
export function savePlanningDraft(userId: number | string | undefined, patch: PlanningDraft): boolean {
  if (userId == null) return false;
  try {
    localStorage.setItem(planningDraftKey(userId), JSON.stringify({ version: 1, updatedAt: Date.now(), value: { ...readPlanningDraft(userId), ...patch } }));
    return true;
  } catch { return false; }
}
export function clearPlanningDraft(userId?: number | string): boolean {
  if (userId == null) return false;
  try { localStorage.removeItem(planningDraftKey(userId)); return true; } catch { return false; }
}
