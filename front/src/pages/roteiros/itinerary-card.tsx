import { CalendarDays, Coins, LoaderCircle, MapPinned } from "lucide-react";

import type { Itinerary } from "@/types/travel";

interface ItineraryCardProps {
  itinerary: Itinerary;
  onOpen: (id: number | string) => void;
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatMoney(value?: string | number | null, currencyCode?: string | null) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return `${value} ${currencyCode ?? ""}`.trim();
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode || "BRL",
  }).format(amount);
}

function getDestinationLabel(itinerary: Itinerary) {
  if (typeof itinerary.destination === "string") {
    return itinerary.destination;
  }

  if (
    itinerary.destination &&
    typeof itinerary.destination === "object" &&
    "name" in itinerary.destination &&
    typeof itinerary.destination.name === "string"
  ) {
    return itinerary.destination.name;
  }

  return itinerary.destination_name || itinerary.city || itinerary.country || "Destino";
}

function formatGenerationStatus(status?: string | null) {
  if (!status) return "Não informado";

  const labels: Record<string, string> = {
    draft: "Rascunho",
    generating: "Gerando",
    ready: "Pronto",
    failed: "Falhou",
  };

  return labels[status] || status;
}

export default function ItineraryCard({ itinerary, onOpen }: ItineraryCardProps) {
  return (
    <article className="rounded-card border border-border bg-white p-6 shadow-card">
      <div className="flex flex-col gap-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Roteiro
            </span>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-strong">
              {formatGenerationStatus(itinerary.generation_status)}
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              {itinerary.title}
            </h3>
            <p className="mt-1 text-sm text-primary">
              {getDestinationLabel(itinerary)}
            </p>
          </div>

          <p className="line-clamp-3 text-sm leading-6 text-strong">
            {itinerary.summary || "Resumo ainda não dispoNível para este roteiro."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Início</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDate(itinerary.start_date)}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-primary">
              <MapPinned className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fim</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDate(itinerary.end_date)}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-primary">
              <LoaderCircle className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Duração</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {Number(itinerary.duration_days || 0)} dias
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-primary">
              <Coins className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Orçamento</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatMoney(itinerary.budget_total, itinerary.currency_code)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Moeda: <span className="font-medium text-strong">{itinerary.currency_code || "BRL"}
            </span>
          </p>

          <button
            type="button"
            onClick={() => onOpen(itinerary.id)}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Abrir roteiro
          </button>
        </div>
      </div>
    </article>
  );
}
