import { useCallback, useEffect, useState } from "react";
import {
  getTravelerDNAProfile,
  saveTravelerDNAProfile,
  type TravelerDNAProfile,
  type TravelerDNAUpsertInput,
} from "@/lib/profiles";

interface UseTravelerDNAProfileReturn {
  profile: TravelerDNAProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  save: (input: TravelerDNAUpsertInput) => Promise<TravelerDNAProfile>;
  refetch: () => void;
}

export function useTravelerDNAProfile(token: string): UseTravelerDNAProfileReturn {
  const [profile, setProfile] = useState<TravelerDNAProfile | null>(null);
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
        const response = await getTravelerDNAProfile(token);
        if (!cancelled) {
          setProfile(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar DNA do viajante.");
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
    async (input: TravelerDNAUpsertInput) => {
      setSaving(true);
      setSaveError(null);

      try {
        const response = await saveTravelerDNAProfile(token, input);
        setProfile(response.data);
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar DNA do viajante.";
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

  return { profile, loading, saving, error, saveError, save, refetch };
}
