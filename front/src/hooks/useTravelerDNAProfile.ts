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

      const safeInput = {
        ...input,
        travel_style: input.travel_style || "A definir",
        pace: input.pace || "A definir",
        comfort_level: input.comfort_level || "A definir",
        social_energy: Number(input.social_energy || 5),
        adventure_level: Number(input.adventure_level || 5),
        food_focus: Number(input.food_focus || 5),
        cultural_interest: Number(input.cultural_interest || 5),
        nature_interest: Number(input.nature_interest || 5),
        nightlife_interest: Number(input.nightlife_interest || 5),
        notes: input.notes || "",
      };

      if (!token) {
        const nextProfile = {
          id: 0,
          user: 0,
          travel_style: safeInput.travel_style,
          pace: safeInput.pace,
          comfort_level: safeInput.comfort_level,
          social_energy: safeInput.social_energy,
          adventure_level: safeInput.adventure_level,
          food_focus: safeInput.food_focus,
          cultural_interest: safeInput.cultural_interest,
          nature_interest: safeInput.nature_interest,
          nightlife_interest: safeInput.nightlife_interest,
          notes: safeInput.notes,
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
            body: JSON.stringify(safeInput),
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
            : "Não foi possível salvar o perfil Traveler DNA.";

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
