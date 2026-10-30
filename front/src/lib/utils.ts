import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: string | number | null | undefined,
  locale = "pt-BR",
  currency = "BRL",
) {
  if (value === null || value === undefined || value === "") return "Sob consulta";
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "Sob consulta";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "BRL",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function formatDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDuration(value: string | number | null | undefined) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Flexível";
  }

  return `${numeric} dias`;
}

export function formatRating(value: string | number | null | undefined) {
  const numeric = Number(value);
  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
