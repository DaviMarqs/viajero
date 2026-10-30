import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/authContext";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("viajero:favorites", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("viajero:favorites", callback);
  };
};

export function useLocalFavorites(
  kind: "destinations" | "itineraries" = "destinations",
) {
  const { user } = useAuth();
  const key = `viajero.${user?.id ?? "guest"}.favorites.${kind}`;
  const snapshot = useCallback(() => {
    try {
      return localStorage.getItem(key) ?? "[]";
    } catch {
      return "[]";
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot);
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed))
      ids = parsed.filter((id): id is string => typeof id === "string");
  } catch {
    /* Ignore damaged local data. */
  }
  function toggle(id: string | number) {
    const value = String(id);
    const next = ids.includes(value)
      ? ids.filter((item) => item !== value)
      : [...ids, value];
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("viajero:favorites"));
  }
  return {
    ids,
    has: (id: string | number) => ids.includes(String(id)),
    toggle,
  };
}
