/** A avaliação da própria viagem só abre depois do dia inteiro da volta. */
export function tripHasEnded(
  endDate: string | null | undefined,
  now = new Date(),
) {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
  const end = new Date(`${endDate}T23:59:59`);
  return Number.isFinite(end.getTime()) && now > end;
}
