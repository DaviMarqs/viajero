import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import type { UserTripPreference as ExistingUserTripPreference } from "../lib/profiles";

export type UserTripPreference = ExistingUserTripPreference;
const GUEST_TRIP_PREFERENCES_KEY = "viajero.guest.trip_preferences";

export interface TripPreferenceUpsertInput {
  [key: string]: any;
}

function readGuestPreferences() {
  const raw = localStorage.getItem(GUEST_TRIP_PREFERENCES_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserTripPreference;
  } catch {
    return null;
  }
}

export function useTripPreferences(token?: string) {
  const [preferences, setPreferences] = useState<UserTripPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!token) {
      setPreferences(readGuestPreferences());
      setLoading(false);
      return;
    }

    try {
      const response = (await apiRequest<{ data?: UserTripPreference }>("/api/trip-preferences/me/", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })) as { data?: UserTripPreference };

      setPreferences(response.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as preferências de viagem.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: TripPreferenceUpsertInput) => {
      setSaving(true);
      setSaveError(null);

      if (!token) {
        const now = new Date().toISOString();
        const nextPreferences = {
          id: 0,
          user: 0,
          budget_min: String(input.budget_min ?? ""),
          budget_max: String(input.budget_max ?? ""),
          currency_code: input.currency_code ?? "BRL",
          companionship: input.companionship ?? "",
          preferred_trip_length_days: input.preferred_trip_length_days ?? 0,
          travel_month: input.travel_month ?? "",
          hotel_level: input.hotel_level ?? "",
          transportation_style: input.transportation_style ?? "",
          dietary_preferences: input.dietary_preferences ?? [],
          accessibility_needs: input.accessibility_needs ?? [],
          interests: input.interests ?? [],
          metadata: input.metadata ?? {},
          created_at: now,
          updated_at: now,
        } as UserTripPreference;

        localStorage.setItem(GUEST_TRIP_PREFERENCES_KEY, JSON.stringify(nextPreferences));
        setPreferences(nextPreferences);
        setSaving(false);
        return nextPreferences;
      }

      try {
  const response = (await apiRequest<{ data?: UserTripPreference }>("/api/trip-preferences/me/", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
  })) as { data?: UserTripPreference };

        const nextPreferences = response.data ?? null;
        setPreferences(nextPreferences);
        return nextPreferences as UserTripPreference;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível salvar as preferências de viagem.";
        setSaveError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token],
  );

  return {
    preferences,
    data: preferences,
    loading,
    saving,
    error,
    saveError,
    refresh,
    refetch: refresh,
    save,
    savePreferences: save,
  };
}
