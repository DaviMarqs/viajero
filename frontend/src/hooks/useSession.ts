import { useEffect, useState } from "react";

type Session = {
  access: string | null;
  refresh: string | null;
  user: Record<string, unknown> | null;
};

const SESSION_KEY = "viajero_session";

export function useSession() {
  const [session, setSession] = useState<Session>(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : { access: null, refresh: null, user: null };
  });

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [session]);

  return { session, setSession };
}

