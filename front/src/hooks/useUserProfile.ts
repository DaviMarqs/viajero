import { useAsyncResource } from "./useAsyncResource";
import { useCallback } from "react";
import { apiRequest } from "../lib/api";
import { getStoredUser, persistGuestUser, type AuthUser } from "../lib/auth";

export function useUserProfile(token?: string) {
  const load = useCallback(async (signal: AbortSignal) => {
    if (!token) return getStoredUser();
    const response = await apiRequest<{ data?: AuthUser | null; }>("/api/users/me/", { signal, headers: { Authorization: `Bearer ${token}` } });
    return response.data ?? null;
  }, [token]);
  const { data: profile, loading, error, refetch: refresh, setData: setProfile } = useAsyncResource<AuthUser | null>(load, null);


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
