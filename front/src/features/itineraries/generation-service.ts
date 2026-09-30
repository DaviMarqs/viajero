import { apiRequest, type ApiSuccessResponse } from "@/lib/api";
import type { Destination, Itinerary } from "@/types/travel";

type Progress = { message: string; itineraryId?: number | string; };

function waitForNextPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 3000);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Facade for the existing create → dates → generate → poll flow. */
export async function generateItinerary(destination: Destination, signal: AbortSignal, onProgress: (progress: Progress) => void) {
  onProgress({ message: "Criando a estrutura inicial do roteiro…" });
  const created = await apiRequest<ApiSuccessResponse<Itinerary>>("/api/itineraries/", {
    method: "POST", body: JSON.stringify({ destination: destination.id, title: destination.name }), signal,
  });
  const itinerary = created.data;
  if (!itinerary?.id) throw new Error("Não foi possível identificar o roteiro criado. Confira seus roteiros antes de tentar novamente.");
  const report = (message: string) => onProgress({ message, itineraryId: itinerary.id });
  report("Preparando as datas do roteiro…");
  const start = new Date(); start.setDate(start.getDate() + 5);
  const duration = Number(itinerary.duration_days ?? 5);
  const end = new Date(start); end.setDate(start.getDate() + (Number.isFinite(duration) && duration > 0 ? duration : 5) - 1);
  await apiRequest(`/api/itineraries/${itinerary.id}/`, { method: "PATCH", body: JSON.stringify({ start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) }), signal });
  report("Solicitando a geração do roteiro…");
  await apiRequest(`/api/itineraries/${itinerary.id}/generate/`, { method: "POST", signal });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    signal.throwIfAborted();
    report("Organizando os dias e atividades. Você pode acompanhar também em Seus roteiros.");
    const response = await apiRequest<ApiSuccessResponse<Itinerary>>(`/api/itineraries/${itinerary.id}/`, { signal });
    if (!response.data) throw new Error("Não foi possível carregar o roteiro criado.");
    if (response.data.generation_status === "ready") return response.data;
    if (response.data.generation_status === "failed") throw new Error("A geração falhou. Abra o roteiro para conferir o estado salvo.");
    if (attempt < 29) await waitForNextPoll(signal);
  }
  throw new Error("A geração está demorando mais que o esperado. Abra o roteiro para continuar acompanhando.");
}
