export type ExchangeRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};
export function convertAmount(
  value: unknown,
  source: string,
  target: string,
  rates: ExchangeRate[],
) {
  if (value == null || value === "" || !Number.isFinite(Number(value)))
    return null;
  if (source === target) return Number(value);
  const from = rates.find((rate) => rate.quote === source);
  const to = rates.find((rate) => rate.quote === target);
  return from && to && from.rate > 0 && to.rate > 0
    ? (Number(value) / from.rate) * to.rate
    : null;
}
