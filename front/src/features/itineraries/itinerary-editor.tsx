import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItineraryActivity } from "./itinerary-activity";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/authContext";
import { apiRequest, type ApiSuccessResponse } from "@/lib/api";
import { localProgramKey, saveLocalProgram } from "./itinerary-editing";
import type { Itinerary, ItineraryDay, ItineraryEvent } from "@/types/travel";

function EventRow({
  event,
  index,
  total,
  move,
  remove,
  destinationImage, destinationName, currency,
}: {
  destinationImage?: string; destinationName: string; currency: string;
  event: ItineraryEvent;
  index: number;
  total: number;
  move: (offset: number) => void;
  remove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(event.id) });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        "inline-event-editor space-y-4 rounded-2xl border border-border bg-white p-5 " +
        (isDragging ? "event-dragging" : "")
      }
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-11 shrink-0 touch-none items-center justify-center rounded-control text-muted-foreground hover:bg-secondary"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${event.title}`}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 text-sm font-medium">
          {event.title}
        </span>
        <div className="flex shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === 0}
            aria-label={`Mover ${event.title} para cima`}
            onClick={() => move(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === total - 1}
            aria-label={`Mover ${event.title} para baixo`}
            onClick={() => move(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" className="text-destructive">
              <Trash2 aria-hidden="true" />
              Remover
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Remover esta atividade?</DialogTitle>
            <DialogDescription>
              {event.title} será removida da programação ao salvar as
              alterações.
            </DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button type="button" variant="destructive" onClick={remove}>
                  Remover atividade
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ItineraryActivity as="div" event={event} index={index} currency={currency} destinationImage={destinationImage} destinationName={destinationName} />
    </li>
  );
}

export function DayEditor({
  day,
  update,
  destinationImage, destinationName, currency,
}: {
  destinationImage?: string; destinationName: string; currency: string;
  day: ItineraryDay;
  update: (day: ItineraryDay) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function apply(next: ItineraryDay) {
    const costs = next.events.map(event => event.estimated_cost == null ? NaN : Number(event.estimated_cost));
    update({...next, estimated_cost: costs.every(Number.isFinite) ? costs.reduce((sum, cost) => sum + cost, 0) : next.estimated_cost});
  }
  function reorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = day.events.findIndex(
      (item) => String(item.id) === event.active.id,
    );
    const to = day.events.findIndex(
      (item) => String(item.id) === event.over?.id,
    );
    if (from >= 0 && to >= 0)
      apply({ ...day, events: arrayMove(day.events, from, to) });
  }
  return (
    <section className="space-y-3">
      <DndContext
        sensors={sensors}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        collisionDetection={closestCenter}
        onDragEnd={reorder}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Para reordenar, pressione espaço. Use as setas para mover e espaço para soltar. Escape cancela.",
          },
          announcements: {
            onDragStart: () => "Atividade selecionada para reordenação.",
            onDragOver: ({ over }) =>
              over
                ? `Movendo para a posição ${day.events.findIndex((item) => String(item.id) === over.id) + 1}.`
                : "Fora da lista.",
            onDragEnd: () => "Reordenação concluída.",
            onDragCancel: () => "Reordenação cancelada.",
          },
        }}
      >
        <SortableContext
          items={day.events.map((event) => String(event.id))}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-5">
            {day.events.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                destinationImage={destinationImage} destinationName={destinationName} currency={currency}
                index={index}
                total={day.events.length}
                remove={() =>
                  apply({
                    ...day,
                    events: day.events.filter((item) => item.id !== event.id),
                  })
                }
                move={(offset) =>
                  apply({
                    ...day,
                    events: arrayMove(day.events, index, index + offset),
                  })
                }
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!day.events.length && (
        <p className="text-sm text-muted-foreground">
          Este dia está livre. Salve ou cancele para recuperar a programação
          anterior.
        </p>
      )}
    </section>
  );
}

export function ItineraryEditor({ itinerary, original, draft, onDraftChange, onSavingChange, onSaved }: {
  itinerary: Itinerary; original: Itinerary; draft: Itinerary | null;
  onDraftChange: (draft: Itinerary | null) => void;
  onSavingChange: (saving: boolean) => void;
  onSaved: (itinerary: Itinerary) => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save() {
    if (!draft) return;
    if (saving) return;
    if (!draft.title.trim()) {
      setError("Dê um nome ao roteiro.");
      return;
    }
    if (
      draft.start_date &&
      draft.end_date &&
      draft.end_date < draft.start_date
    ) {
      setError("A data de volta deve ser igual ou posterior à data de ida.");
      return;
    }
    setSaving(true);
    onSavingChange(true);
    setError("");
    const key = localProgramKey(user?.id, itinerary.id);
    let previous: string | null = null;
    let localSaved = false;
    try {
      previous = localStorage.getItem(key);
      const days = saveLocalProgram(original, draft.days ?? [], key);
      localSaved = true;
      const response = await apiRequest<ApiSuccessResponse<Itinerary>>(
        `/api/itineraries/${itinerary.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: draft.title.trim(),
            summary: draft.summary ?? "",
            start_date: draft.start_date || null,
            end_date: draft.end_date || null,
          }),
        },
      );
      if (!response.data)
        throw new Error(
          "O serviço não retornou o roteiro atualizado. Recarregue antes de tentar novamente.",
        );
      onSaved({ ...response.data, is_owner: true, days });
      onDraftChange(null);
      setMessage("Alterações salvas. A programação foi salva neste navegador.");
    } catch (err) {
      if (localSaved) {
        try {
          if (previous === null) localStorage.removeItem(key);
          else localStorage.setItem(key, previous);
        } catch {
          /* Keep the save error visible. */
        }
      }
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }
  return <div className="action-control">
    {draft ? <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={() => { onDraftChange(null); setError(""); }}>Cancelar edição</Button>
      <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
    </div> : <Button type="button" onClick={() => { onDraftChange(structuredClone(itinerary)); setError(""); setMessage(""); }}><Pencil aria-hidden="true" />Editar roteiro</Button>}
    {error && <p role="alert" className="action-message text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="action-message text-sm text-success">{message}</p>}
  </div>;
}
