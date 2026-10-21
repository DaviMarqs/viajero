import { parseTripDate } from "@/lib/trip-dates";

export function planningDate(value?: string, year = false): string {
  const date = parseTripDate(value);
  if (!date) return "A definir";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(date).replace(/ de /g, " ").replace(".", "");
}
export function planningPeriod(start?: string, end?: string): string {
  const from = parseTripDate(start), to = parseTripDate(end);
  if (!from) return "Período a definir";
  if (!to) return `${planningDate(start, true)} → A definir`;
  return from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear() ? `${from.getUTCDate()}–${planningDate(end, true)}` : `${planningDate(start, true)} → ${planningDate(end, true)}`;
}
