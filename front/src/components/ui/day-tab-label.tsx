export function DayTabLabel({ start, day }: { start?: string | null; day: number }) {
  const date = start ? new Date(`${start}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime())) return <>Dia {day} · data a definir</>;
  date.setUTCDate(date.getUTCDate() + day - 1);
  return <time dateTime={date.toISOString().slice(0, 10)}>{new Intl.DateTimeFormat("pt-BR", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(date).replace(/\./g, "")}</time>;
}
