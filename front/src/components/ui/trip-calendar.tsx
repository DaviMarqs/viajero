import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { dateKey, displayTripDate, parseTripDate, selectTripRange, tripDuration } from "@/lib/trip-dates";

export function TripCalendar({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => { const initial = parseTripDate(start) ?? new Date(); return new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)); });
  const [focusDate, setFocusDate] = useState(start || dateKey(month));
  const duration = tripDuration(start, end);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (month.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => index - offset + 1);
  function moveMonth(offset: number) { const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1)); setMonth(next); setFocusDate(dateKey(next)); }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, value: string) {
    const date = parseTripDate(value)!;
    const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(date.getUTCDay() + 6) % 7, End: 6 - (date.getUTCDay() + 6) % 7 };
    if (event.key === "PageUp" || event.key === "PageDown") { const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + (event.key === "PageUp" ? -1 : 1)); date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate())); }
    else if (event.key in shifts) date.setUTCDate(date.getUTCDate() + shifts[event.key]);
    else return;
    if (start && !end && (tripDuration(start, dateKey(date)) ?? 0) > 60) return;
    event.preventDefault();
    const next = dateKey(date); setFocusDate(next);
    if (date.getUTCMonth() !== month.getUTCMonth() || date.getUTCFullYear() !== month.getUTCFullYear()) setMonth(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
  }
  return <div className="trip-calendar space-y-4" ref={ref}>
    <div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" /></Button><h3 id={`${id}-month`} className="font-medium capitalize" aria-live="polite">{label}</h3><Button type="button" variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" /></Button></div>
    <p id={`${id}-hint`} className="text-sm text-muted-foreground">{end ? "Período selecionado. Clique em uma data para escolher outro intervalo." : !start ? "Selecione a ida e depois a volta." : "Agora selecione a volta, até 60 dias contando a ida."} Use as setas do teclado para navegar.</p>
    <table className="w-full table-fixed text-center" aria-labelledby={`${id}-month`} aria-describedby={`${id}-hint`}><thead><tr>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => <th key={day} scope="col" className="pb-2 text-xs font-normal text-muted-foreground">{day}</th>)}</tr></thead><tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>{cells.slice(week * 7, week * 7 + 7).map((day, index) => {
      if (day < 1 || day > count) return <td key={index} />;
      const value = dateKey(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)));
      const selected = value === start || value === end;
      const inRange = !!start && !!end && value > start && value < end;
      const tooLong = !!start && !end && value >= start && (tripDuration(start, value) ?? 0) > 60;
      return <td key={index} className={inRange ? "calendar-in-range" : ""}><button type="button" data-date={value} className="calendar-day" data-selected={selected} aria-pressed={selected} disabled={tooLong} tabIndex={focusDate === value ? 0 : -1} aria-label={`${displayTripDate(value)}${value === start ? ", ida" : value === end ? ", volta" : inRange ? ", dentro da viagem" : ""}`} onFocus={() => setFocusDate(value)} onKeyDown={event => keyboard(event, value)} onClick={() => { const next = selectTripRange(start, end, value); onChange(next.start, next.end); }}>{day}</button></td>;
    })}</tr>)}</tbody></table>
    <div className="grid gap-3 sm:grid-cols-2"><label className="form-label">Ida<Input type="date" value={start} onChange={event => onChange(event.target.value, end && end >= event.target.value ? end : "")} /></label><label className="form-label">Volta<Input type="date" min={start || undefined} value={end} onChange={event => onChange(start, event.target.value)} /></label></div>
    <p role="status" className="text-sm font-medium">{duration ? `${duration} ${duration === 1 ? "dia" : "dias"} de viagem · ${displayTripDate(start)} a ${displayTripDate(end)}` : "Escolha o período para calcular a duração."}</p>
    {start && end && (!duration || duration > 60) && <p role="alert" className="text-sm text-destructive">Selecione uma volta igual ou posterior à ida, com duração máxima de 60 dias.</p>}
  </div>;
}
