import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, apiRequest, type ApiSuccessResponse } from "@/lib/api";
import type { Itinerary, ItineraryDay } from "@/types/travel";
import { applyProgram, createSaveQueue, programHistorySize, programLayout, tripEndDate, type SaveQueue } from "./program-sync";

const TITLE_DEBOUNCE_MS = 800;

/** saving/saved/error seguem a fila; rejected = o servidor recusou a ação e a tela voltou ao estado salvo. */
export type ProgramSaveStatus = "idle" | "saving" | "saved" | "error" | "rejected";

type ItineraryResponse = ApiSuccessResponse<Itinerary>;

function serverItinerary(response: ItineraryResponse): Itinerary {
  if (!response.data) throw new Error("O serviço não retornou o roteiro atualizado. Recarregue a página.");
  return { ...response.data, is_owner: true };
}

/**
 * Salvamento automático da edição do roteiro (#50). Toda ação aparece na tela na hora e entra numa fila
 * sequencial; a resposta do servidor só substitui a tela quando não há ação mais nova esperando.
 */
export function useItineraryProgram(itinerary: Itinerary | null, onChange: (next: Itinerary) => void) {
  const [status, setStatus] = useState<ProgramSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const current = useRef(itinerary);
  const onChangeRef = useRef(onChange);
  const failedTask = useRef<(() => Promise<Itinerary>) | null>(null);
  const titleTimer = useRef<number | undefined>(undefined);
  const pendingTitle = useRef<string | null>(null);
  useLayoutEffect(() => {
    current.current = itinerary;
    onChangeRef.current = onChange;
  });

  const show = useCallback((next: Itinerary) => {
    current.current = next;
    onChangeRef.current(next);
  }, []);

  // A fila nasce no primeiro uso (sempre num evento, nunca durante a renderização).
  const queueRef = useRef<SaveQueue<Itinerary> | null>(null);
  const queue = useCallback((): SaveQueue<Itinerary> => {
    if (queueRef.current) return queueRef.current;
    const created = createSaveQueue<Itinerary>({
      onStart: () => {
        setStatus("saving");
        setError(null);
      },
      onSettled: (outcome, latest) => {
        if (!latest) return;
        if (outcome.ok) {
          failedTask.current = null;
          show(outcome.value);
          setStatus("saved");
          return;
        }
        const message = outcome.error instanceof Error ? outcome.error.message : "Não foi possível salvar a alteração.";
        setError(message);
        if (outcome.error instanceof ApiError && outcome.error.status >= 400 && outcome.error.status < 500) {
          // O servidor recusou (layout inválido, roteiro mudou em outra aba...): volta para o que está salvo.
          failedTask.current = null;
          setStatus("rejected");
          const id = current.current?.id;
          if (id != null) void apiRequest<ItineraryResponse>(`/api/itineraries/${id}/`).then(response => { if (created.size() === 0) show(serverItinerary(response)); }).catch(() => undefined);
          return;
        }
        failedTask.current = outcome.task;
        setStatus("error");
      },
    });
    queueRef.current = created;
    return created;
  }, [show]);

  const sendProgram = useCallback((next: Itinerary) => {
    const body = JSON.stringify(programLayout(next.days ?? []));
    void queue().push(async () => serverItinerary(await apiRequest<ItineraryResponse>(`/api/itineraries/${next.id}/program/`, { method: "PUT", body })));
  }, [queue]);

  /** Aplica a nova ordem dos dias na tela e agenda o PUT. Devolve a mensagem de erro quando a ação é inválida. */
  const changeDays = useCallback((change: (days: ItineraryDay[]) => ItineraryDay[]): string | null => {
    const base = current.current;
    if (!base) return null;
    let next: Itinerary;
    try {
      next = applyProgram(base, change(base.days ?? []));
    } catch (err) {
      return err instanceof Error ? err.message : "Não foi possível aplicar esta alteração.";
    }
    show(next);
    sendProgram(next);
    return null;
  }, [sendProgram, show]);

  const saveDetails = useCallback((details: { title?: string; start_date?: string | null; end_date?: string | null }) => {
    const base = current.current;
    if (!base) return;
    show({ ...base, ...details });
    const body = JSON.stringify(details);
    void queue().push(async () => serverItinerary(await apiRequest<ItineraryResponse>(`/api/itineraries/${base.id}/`, { method: "PATCH", body })));
  }, [queue, show]);

  const sendTitle = useCallback(() => {
    window.clearTimeout(titleTimer.current);
    const title = pendingTitle.current;
    pendingTitle.current = null;
    if (title !== null && title !== current.current?.title) saveDetails({ title });
  }, [saveDetails]);

  /** Envia o nome pendente agora e devolve o campo ao valor salvo (Concluir edição, Desfazer). */
  const flushTitle = useCallback(() => {
    sendTitle();
    setTitleDraft(null);
  }, [sendTitle]);

  /** Nome: o campo responde na hora e o PATCH sai 800 ms depois da última tecla. */
  const editTitle = useCallback((value: string) => {
    setTitleDraft(value);
    window.clearTimeout(titleTimer.current);
    const title = value.trim();
    pendingTitle.current = title || null;
    if (title) titleTimer.current = window.setTimeout(sendTitle, TITLE_DEBOUNCE_MS);
  }, [sendTitle]);

  /** Ida editável; a volta é sempre ida + duração − 1. Ida vazia deixa as duas datas em aberto. */
  const editStartDate = useCallback((value: string) => {
    const base = current.current;
    if (!base) return;
    const start = value || null;
    const end = start ? tripEndDate(start, base.duration_days) : null;
    if (start && !end) return;
    if (start === (base.start_date ?? null) && end === (base.end_date ?? null)) return;
    saveDetails({ start_date: start, end_date: end });
  }, [saveDetails]);

  /** Desfazer no servidor: espera a fila esvaziar e restaura o último snapshot. */
  const undo = useCallback(async () => {
    const id = current.current?.id;
    if (id == null) return;
    flushTitle();
    setUndoing(true);
    try {
      await queue().drain();
      await queue().push(async () => serverItinerary(await apiRequest<ItineraryResponse>(`/api/itineraries/${id}/program/undo/`, { method: "POST" })));
    } finally {
      setUndoing(false);
    }
  }, [flushTitle, queue]);

  const retry = useCallback(() => {
    const task = failedTask.current;
    failedTask.current = null;
    if (task) void queue().push(task);
  }, [queue]);

  // Sair da página com o nome ainda no debounce: envia antes de desmontar.
  useEffect(() => () => {
    window.clearTimeout(titleTimer.current);
    const title = pendingTitle.current;
    const base = current.current;
    if (title && base && title !== base.title) {
      void apiRequest(`/api/itineraries/${base.id}/`, { method: "PATCH", body: JSON.stringify({ title }) }).catch(() => undefined);
    }
  }, []);

  const busy = status === "saving" || undoing;
  return {
    status,
    error,
    busy,
    undoing,
    canUndo: busy || programHistorySize(itinerary) > 0,
    canRetry: status === "error",
    titleDraft,
    changeDays,
    editTitle,
    flushTitle,
    editStartDate,
    undo,
    retry,
  };
}
