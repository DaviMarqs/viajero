import { AnimatedNumber } from "@/components/motion/animated-number";
import { planningDate } from "./planning-date";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

import { dateKey, displayTripDate, parseTripDate, selectTripRange, tripDuration } from "@/lib/trip-dates";

export function TripCalendar({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => { const initial = parseTripDate(start) ?? new Date(); return new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)); });
  const [focusDate, setFocusDate] = useState(start || dateKey(month));
  const previousRange = useRef({ start, end });
  const now = new Date();
  const today = dateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  const duration = tripDuration(start, end);
  const [preview, setPreview] = useState("");
  const [picked, setPicked] = useState({ value: "", count: 0 });
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = month.getUTCDay();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => index - offset + 1);
  const firstAvailable = dateKey(month) < today ? today : dateKey(month);
  const focusKey = focusDate >= today && focusDate.startsWith(dateKey(month).slice(0, 7)) ? focusDate : firstAvailable;
  function moveMonth(offset: number) { const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1)); setMonth(next); setFocusDate(dateKey(next)); }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, value: string) {
    if (event.key === "Escape") { event.preventDefault(); onChange(previousRange.current.start, previousRange.current.end); return; }
    const date = parseTripDate(value)!;
    const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getUTCDay(), End: 6 - date.getUTCDay() };
    if (event.key === "PageUp" || event.key === "PageDown") { const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + (event.key === "PageUp" ? -1 : 1)); date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate())); }
    else if (event.key in shifts) date.setUTCDate(date.getUTCDate() + shifts[event.key]);
    else return;
    if (dateKey(date) < today) { event.preventDefault(); return; }
    if (start && !end && (tripDuration(start, dateKey(date)) ?? 0) > 60) { event.preventDefault(); return; }
    event.preventDefault();
    const next = dateKey(date); setFocusDate(next);
    if (date.getUTCMonth() !== month.getUTCMonth() || date.getUTCFullYear() !== month.getUTCFullYear()) setMonth(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
  }
  return <div className="trip-calendar" ref={ref}>
    <div className="calendar-grid-panel"><div className="calendar-month-header"><Button type="button" variant="outline" size="icon" className="calendar-month-button" aria-label="Mês anterior" onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" /></Button><h3 id={`${id}-month`} className="font-medium" aria-live="polite">{label}</h3><Button type="button" variant="outline" size="icon" className="calendar-month-button" aria-label="Próximo mês" onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" /></Button></div>
    <span id={`${id}-hint`} className="sr-only">Selecione a ida e depois a volta. Use as setas para navegar, PageUp e PageDown para trocar o mês, Enter ou Espaço para selecionar e Esc para cancelar.</span>
    <table onMouseLeave={() => setPreview("")} role="grid" className="calendar-grid" aria-labelledby={`${id}-month`} aria-describedby={`${id}-hint`}><thead><tr>{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <th key={day} scope="col" className="pb-2 text-xs font-normal text-muted-foreground">{day}</th>)}</tr></thead><tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>{cells.slice(week * 7, week * 7 + 7).map((day, index) => {
      if (day < 1 || day > count) return <td key={index} />;
      const value = dateKey(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)));
      const selected = value === start || value === end;
      const visualEnd = end || (preview > start && (tripDuration(start, preview) ?? 61) <= 60 ? preview : "");
      const connectedRange = !!start && visualEnd > start;
      const inRange = !!start && !!visualEnd && value > start && value < visualEnd;
      const tooLong = value < today || !!start && !end && value >= start && (tripDuration(start, value) ?? 0) > 60;
      return <td key={index} className={inRange ? "calendar-in-range" : ""} data-range-start={connectedRange && value === start} data-range-end={connectedRange && value === visualEnd}><button type="button" data-date={value} className="calendar-day" data-picked={picked.value === value ? picked.count % 2 : undefined} data-today={value === today} aria-disabled={tooLong} data-selected={selected} aria-pressed={selected} disabled={tooLong} tabIndex={!tooLong && focusKey === value ? 0 : -1} aria-label={`${displayTripDate(value)}${value === start ? ", ida" : value === end ? ", volta" : end && inRange ? ", dentro da viagem" : ""}`} onMouseEnter={() => { if (start && !end && matchMedia("(hover: hover) and (pointer: fine)").matches) setPreview(value); }} onFocus={() => setFocusDate(value)} onKeyDown={event => keyboard(event, value)} onClick={() => { setPicked(previous => ({ value, count: previous.count + 1 })); if (!start || end) previousRange.current = { start, end }; const next = selectTripRange(start, end, value); onChange(next.start, next.end); }}>{day}</button></td>;
    })}</tr>)}</tbody></table>
    </div><div className="calendar-summary"><dl><div><dt>Ida</dt><dd>{start ? planningDate(start, true) : "A definir"}</dd></div><div><dt>Volta</dt><dd>{end ? planningDate(end, true) : "A definir"}</dd></div><div><dt>Duração</dt><dd role="status">{duration ? <><AnimatedNumber durationToken="--duration-fast" value={duration} animate={picked.count > 0} format={value => String(Math.round(value))} /> {duration === 1 ? "dia" : "dias"}</> : "A definir"}</dd></div></dl>{(start || end) && <Button type="button" variant="ghost" className="calendar-clear" onClick={() => onChange("", "")}>Limpar datas</Button>}<span className="field-support">Ida e volta contam na duração. Máximo de 60 dias.</span>{start && end && (!duration || duration > 60) && <span role="alert" className="field-support">Selecione uma volta igual ou posterior à ida, com duração máxima de 60 dias.</span>}</div>
  </div>;
}
