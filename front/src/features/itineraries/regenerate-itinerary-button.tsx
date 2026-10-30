import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/motion/toast-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, type ApiSuccessResponse } from "@/lib/api";
import type { Itinerary } from "@/types/travel";

/**
 * Gera de novo a programação com a IA (POST /generate no mesmo roteiro). Nome e datas são mantidos;
 * as atividades ganham novos ids e o servidor apaga o histórico de alterações para desfazer.
 */
export function RegenerateItineraryButton({
  itinerary,
  onRegenerated,
}: {
  itinerary: Itinerary;
  onRegenerated: (itinerary: Itinerary) => void;
}) {
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const failed = itinerary.generation_status === "failed";

  async function regenerate() {
    setRunning(true);
    setError(null);
    try {
      const response = await apiRequest<ApiSuccessResponse<Itinerary>>(`/api/itineraries/${itinerary.id}/generate/`, { method: "POST" });
      if (!response.data) throw new Error("Não foi possível carregar o roteiro gerado.");
      onRegenerated({ ...response.data, is_owner: true });
      setOpen(false);
      notify({ title: "Roteiro gerado novamente." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o roteiro novamente.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button ref={triggerRef} variant={failed ? "default" : "outline"} onClick={() => { setError(null); setOpen(true); }}>
        <RefreshCw aria-hidden="true" />
        {failed ? "Tentar gerar de novo" : "Gerar novamente"}
      </Button>
      <Dialog open={open} onOpenChange={next => { if (!running) setOpen(next); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Gerar o roteiro novamente?</DialogTitle>
            <DialogDescription>
              A IA vai montar uma nova programação com os parâmetros desta viagem. As atividades, os horários e os custos atuais serão substituídos, e as alterações feitas antes não poderão mais ser desfeitas. O nome do roteiro e as datas são mantidos.
            </DialogDescription>
          </DialogHeader>
          {running && <p role="status" className="text-sm text-muted-foreground">Gerando a nova programação. Isso leva alguns segundos.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={running}>Cancelar</Button>
            </DialogClose>
            <Button onClick={regenerate} loading={running}>
              Gerar novamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
