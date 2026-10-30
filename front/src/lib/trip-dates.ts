const DAY = 86400000;
export function parseTripDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function tripDuration(start?: string, end?: string): number | null {
  const from = parseTripDate(start), to = parseTripDate(end);
  if (!from || !to || to < from) return null;
  return Math.round((to.getTime() - from.getTime()) / DAY) + 1;
}
export function displayTripDate(value?: string): string {
  const date = parseTripDate(value);
  return date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date) : "A definir";
}
export function selectTripRange(start: string, end: string, selected: string) {
  if (!start || end || selected < start) return { start: selected, end: "" };
  return { start, end: selected };
}
