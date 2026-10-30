import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DropdownMenu } from "radix-ui";
import { ArrowDown, ArrowUp, CalendarArrowDown, CloudAlert, CloudCheck, GripVertical, LoaderCircle, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DayTabLabel } from "@/components/ui/day-tab-label";
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
import { tripEndDate } from "./program-sync";
import type { ProgramSaveStatus } from "./use-itinerary-program";
import type { Itinerary, ItineraryDay, ItineraryEvent } from "@/types/travel";

function DayOption({ day, start }: { day: number; start?: string | null }) {
  return start ? <>Dia {day} · <DayTabLabel start={start} day={day} /></> : <DayTabLabel day={day} />;
}

function EventRow({
  event,
  index,
  total,
  days,
  startDate,
  shift,
  moveTo,
  remove,
  destinationImage, destinationName, currency,
}: {
  destinationImage?: string; destinationName: string; currency: string;
  event: ItineraryEvent;
  index: number;
  total: number;
  /** Outros dias para onde a atividade pode ir. */
  days: ItineraryDay[];
  startDate?: string | null;
  shift: (offset: number) => void;
  moveTo: (dayNumber: number) => void;
  remove: () => void;
}) {
  const reduced = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(event.id), transition: reduced ? null : { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        "inline-event-editor space-y-4 " +
        (isDragging ? "event-dragging" : "")
      }
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="activity-drag-handle flex size-11 shrink-0 touch-none items-center justify-center rounded-control text-muted-foreground hover:bg-secondary"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${event.title}`}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 text-sm font-medium">
          Atividade {index + 1}
        </span>
        <div className="flex shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === 0}
            aria-label={`Mover ${event.title} para cima`}
            onClick={() => shift(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === total - 1}
            aria-label={`Mover ${event.title} para baixo`}
            onClick={() => shift(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-2">
        {days.length > 0 && <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button type="button" variant="ghost">
              <CalendarArrowDown aria-hidden="true" />
              Mover para o dia…<span className="sr-only"> ({event.title})</span>
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={8} className="currency-dropdown day-move-menu" aria-label={`Escolher o dia para ${event.title}`}>
              {days.map(day => <DropdownMenu.Item key={day.id} className="currency-option" onSelect={() => moveTo(day.day_number)}>
                <DayOption day={day.day_number} start={startDate} />
              </DropdownMenu.Item>)}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>}
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" className="text-destructive">
              <Trash2 aria-hidden="true" />
              Remover<span className="sr-only"> {event.title}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Remover esta atividade?</DialogTitle>
            <DialogDescription>
              {event.title} sairá da programação e os horários do dia serão
              recalculados. Você pode desfazer logo em seguida.
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

/** Lista editável de um dia: arrastar ou setas reordenam; o menu leva a atividade para o fim de outro dia. */
export function DayEditor({
  day,
  days,
  startDate,
  onReorder,
  onMove,
  onRemove,
  destinationImage, destinationName, currency,
}: {
  destinationImage?: string; destinationName: string; currency: string;
  day: ItineraryDay;
  days: ItineraryDay[];
  startDate?: string | null;
  onReorder: (from: number, to: number) => void;
  onMove: (event: ItineraryEvent, dayNumber: number) => void;
  onRemove: (event: ItineraryEvent) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const dragged = day.events.find(event => String(event.id) === activeId);
  // A atividade movida ou removida sai da lista junto com o botão que tinha o foco: o foco vai para o dia.
  const keepFocus = () => window.setTimeout(() => listRef.current?.focus(), 0);
  const otherDays = days.filter(item => item.day_number !== day.day_number);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function reorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = day.events.findIndex(
      (item) => String(item.id) === event.active.id,
    );
    const to = day.events.findIndex(
      (item) => String(item.id) === event.over?.id,
    );
    if (from >= 0 && to >= 0) onReorder(from, to);
  }
  return (
    <section ref={listRef} tabIndex={-1} aria-label={`Atividades do dia ${day.day_number}`} className="space-y-3">
      <DndContext
        sensors={sensors}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={event => { setActiveId(null); reorder(event); }}
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
                days={otherDays}
                startDate={startDate}
                remove={() => { onRemove(event); keepFocus(); }}
                moveTo={(dayNumber) => { onMove(event, dayNumber); keepFocus(); }}
                shift={(offset) => onReorder(index, index + offset)}
              />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={reduced ? null : { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>{dragged && <div className="activity-drag-overlay" aria-hidden="true"><ItineraryActivity as="div" event={dragged} index={0} currency={currency} destinationName={destinationName} /></div>}</DragOverlay>
      </DndContext>
      {!day.events.length && (
        <p className="text-sm text-muted-foreground">
          Este dia está livre. Traga uma atividade de outro dia pelo menu
          “Mover para o dia…” ou use Desfazer.
        </p>
      )}
    </section>
  );
}

/** Nome com salvamento automático e ida editável; a volta acompanha a duração do roteiro. */
export function ItineraryDetailsEditor({ itinerary, titleDraft, disabled, onTitleChange, onStartDateCommit }: {
  itinerary: Itinerary;
  titleDraft: string | null;
  disabled?: boolean;
  onTitleChange: (value: string) => void;
  onStartDateCommit: (value: string) => void;
}) {
  const id = useId();
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const title = titleDraft ?? itinerary.title;
  const start = startDraft ?? itinerary.start_date ?? "";
  const end = tripEndDate(start, itinerary.duration_days) ?? (startDraft == null ? itinerary.end_date ?? "" : "");
  const duration = Number(itinerary.duration_days);
  function commitStart() {
    if (startDraft == null) return;
    // Datas pela metade (ano sendo digitado) não são enviadas.
    if (startDraft === "" || (startDraft >= "1900-01-01" && tripEndDate(startDraft, itinerary.duration_days))) onStartDateCommit(startDraft);
    setStartDraft(null);
  }
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-3">
      <label className="form-label">
        Nome do roteiro
        <Input maxLength={160} value={title} aria-invalid={!title.trim() || undefined} aria-describedby={`${id}-title`} onChange={event => onTitleChange(event.target.value)} />
        <span id={`${id}-title`} className={title.trim() ? "field-support" : "field-support text-destructive"}>
          {title.trim() ? "Salvo automaticamente enquanto você digita." : "Dê um nome ao roteiro."}
        </span>
      </label>
      <label className="form-label">
        Ida
        <Input type="date" value={start} onChange={event => setStartDraft(event.target.value)} onBlur={commitStart} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commitStart(); } }} />
      </label>
      <label className="form-label">
        Volta
        <Input type="date" value={end} readOnly className="bg-muted text-muted-foreground" aria-describedby={`${id}-end`} />
        <span id={`${id}-end`} className="field-support">
          {Number.isInteger(duration) && duration > 0 ? `Calculada pela duração de ${duration} ${duration === 1 ? "dia" : "dias"}.` : "Calculada pela duração da viagem."}
        </span>
      </label>
    </fieldset>
  );
}

function SaveStatus({ status, error }: { status: ProgramSaveStatus; error: string | null }) {
  const failed = status === "error" || status === "rejected";
  const Icon = status === "saving" ? LoaderCircle : failed ? CloudAlert : CloudCheck;
  return (
    <p role="status" className={"flex items-center gap-2 text-xs " + (failed ? "text-destructive" : "text-muted-foreground")}>
      <Icon className={status === "saving" ? "motion-spinner size-4" : "size-4"} aria-hidden="true" />
      {status === "saving" ? "Salvando…" : status === "error" ? "Erro ao salvar" : status === "rejected" ? error ?? "Erro ao salvar" : "Todas as alterações salvas"}
    </p>
  );
}

/** Barra do modo de edição: status do salvamento automático, Desfazer e Concluir edição. */
export function ItineraryEditToolbar({ editing, status, error, canRetry, canUndo, undoing, onEdit, onFinish, onUndo, onRetry }: {
  editing: boolean;
  status: ProgramSaveStatus;
  error: string | null;
  canRetry: boolean;
  canUndo: boolean;
  undoing: boolean;
  onEdit: () => void;
  onFinish: () => void;
  onUndo: () => void;
  onRetry: () => void;
}) {
  const showStatus = editing || status === "saving" || status === "error" || status === "rejected";
  return <div className="action-control itinerary-editor-actions">
    <div className="flex flex-wrap items-center gap-2">
      {showStatus && <SaveStatus status={status} error={error} />}
      {canRetry && <Button type="button" variant="outline" onClick={onRetry}>Tentar de novo</Button>}
      {editing ? <>
        <Button type="button" variant="ghost" disabled={!canUndo} loading={undoing} onClick={onUndo}><Undo2 aria-hidden="true" />Desfazer</Button>
        <Button type="button" onClick={onFinish}>Concluir edição</Button>
      </> : <Button type="button" onClick={onEdit}><Pencil aria-hidden="true" />Editar roteiro</Button>}
    </div>
  </div>;
}
