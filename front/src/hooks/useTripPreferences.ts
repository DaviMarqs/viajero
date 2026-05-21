import { useCallback, useEffect, useState } from "react";
import {
  getTripPreferences,
  saveTripPreferences,
  type TripPreferenceUpsertInput,
  type UserTripPreference,
} from "@/lib/profiles";

interface UseTripPreferencesReturn {
  preferences: UserTripPreference | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  save: (input: TripPreferenceUpsertInput) => Promise<UserTripPreference>;
  refetch: () => void;
}

export function useTripPreferences(token: string): UseTripPreferencesReturn {
  const [preferences, setPreferences] = useState<UserTripPreference | null>(null);
  const [loading, setLoading] = useState(() => !!token);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await getTripPreferences(token);
        if (!cancelled) {
          setPreferences(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar preferencias.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, trigger]);

  const save = useCallback(
    async (input: TripPreferenceUpsertInput) => {
      setSaving(true);
      setSaveError(null);

      try {
        const response = await saveTripPreferences(token, input);
        setPreferences(response.data);
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar preferencias.";
        setSaveError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token],
  );

  const refetch = useCallback(() => {
    setTrigger((current) => current + 1);
  }, []);

  return { preferences, loading, saving, error, saveError, save, refetch };
}
