import { useCallback, useEffect, useState } from "react";

/** Owns request cancellation and ignores results from a previous identity. */
export function useAsyncResource<T>(load: (signal: AbortSignal) => Promise<T>, initial: T) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ load: typeof load; revision: number; data?: T; error: string | null; }>();
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ load, revision, data, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ load, revision, error: error instanceof Error ? error.message : "Não foi possível carregar os dados." });
    });
    return () => controller.abort();
  }, [load, revision]);
  const setData = useCallback((data: T) => setState({ load, revision, data, error: null }), [load, revision]);
  const current = state?.load === load && state.revision === revision ? state : undefined;
  return {
    data: current?.data ?? initial,
    error: current?.error ?? null,
    loading: !current,
    refetch: () => setRevision(value => value + 1),
    setData,
  };
}
