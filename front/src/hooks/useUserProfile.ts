import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { getStoredUser, persistGuestUser, type AuthUser } from "../lib/auth";

export function useUserProfile(token?: string) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!token) {
      setProfile(getStoredUser());
      setLoading(false);
      return;
    }

    try {
      const response = (await apiRequest<{ data?: AuthUser }>("/api/users/me/", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })) as { data?: AuthUser };

      setProfile(response.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o perfil.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    profile,
    data: profile,
    user: profile,
    loading,
    error,
    refresh,
    refetch: refresh,
    saveGuestProfile: (input: Partial<AuthUser>) => {
      const nextUser = persistGuestUser(input);
      setProfile(nextUser);
      return nextUser;
    },
  };
}
