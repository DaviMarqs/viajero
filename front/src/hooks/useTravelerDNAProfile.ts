import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import type { TravelerDNAProfile as ExistingTravelerDNAProfile } from "../lib/profiles";

export type TravelerDNAProfile = ExistingTravelerDNAProfile;

const GUEST_TRAVELER_DNA_KEY = "viajero.guest.traveler_dna";

export interface TravelerDNAUpsertInput {
  [key: string]: any;
}

function readGuestProfile() {
  const raw = localStorage.getItem(GUEST_TRAVELER_DNA_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as TravelerDNAProfile;
  } catch {
    return null;
  }
}

export function useTravelerDNAProfile(token?: string) {
  const [profile, setProfile] = useState<TravelerDNAProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!token) {
      setProfile(readGuestProfile());
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest<{ data?: TravelerDNAProfile | null }>(
        "/api/traveler-dna/me/",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setProfile(response.data ?? null);
    } catch (err) {
      setProfile(null);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o perfil Traveler DNA.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: TravelerDNAUpsertInput) => {
      setSaving(true);
      setSaveError(null);

      if (!token) {
        const nextProfile = {
          id: 0,
          user: 0,
          travel_style: input.travel_style,
          pace: input.pace,
          comfort_level: input.comfort_level,
          social_energy: input.social_energy,
          adventure_level: input.adventure_level,
          food_focus: input.food_focus,
          cultural_interest: input.cultural_interest,
          nature_interest: input.nature_interest,
          nightlife_interest: input.nightlife_interest,
          notes: input.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TravelerDNAProfile;

        localStorage.setItem(
          GUEST_TRAVELER_DNA_KEY,
          JSON.stringify(nextProfile),
        );

        setProfile(nextProfile);
        setSaving(false);

        return nextProfile;
      }

      try {
        const response = await apiRequest<{ data?: TravelerDNAProfile }>(
          "/api/traveler-dna/me/",
          {
            method: "PATCH",
            body: JSON.stringify(input),
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const nextProfile = response.data ?? null;

        setProfile(nextProfile);

        return nextProfile as TravelerDNAProfile;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível salvar o perfil DNA do viajante.";

        setSaveError(message);

        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token],
  );

  const hasProfile = Boolean(profile);

  return {
    profile,
    data: profile,
    hasProfile,
    loading,
    saving,
    error,
    saveError,
    refresh,
    refetch: refresh,
    save,
    saveProfile: save,
  };
}
