import { CalendarDays, Coins, LoaderCircle, MapPinned } from "lucide-react";

import type { Itinerary } from "@/types/travel";

interface ItineraryCardProps {
  itinerary: Itinerary;
  onOpen: (id: number | string) => void;
}

function formatDate(value?: string | null) {
  if (!value) return "Nao informado";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatMoney(value?: string | number | null, currencyCode?: string | null) {
  if (value === null || value === undefined || value === "") {
    return "Nao informado";
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
  if (!status) return "Nao informado";

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
    <article className="rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_18px_60px_rgba(56,189,248,0.08)]">
      <div className="flex flex-col gap-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Roteiro
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-slate-600">
              {formatGenerationStatus(itinerary.generation_status)}
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
              {itinerary.title}
            </h3>
            <p className="mt-1 text-sm text-sky-700">
              {getDestinationLabel(itinerary)}
            </p>
          </div>

          <p className="line-clamp-3 text-sm leading-6 text-slate-600">
            {itinerary.summary || "Resumo ainda nao disponivel para este roteiro."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-sky-700">
              <CalendarDays className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inicio</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(itinerary.start_date)}
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-sky-700">
              <MapPinned className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fim</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(itinerary.end_date)}
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-sky-700">
              <LoaderCircle className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Duracao</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {Number(itinerary.duration_days || 0)} dias
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-sky-700">
              <Coins className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Orcamento</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatMoney(itinerary.budget_total, itinerary.currency_code)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Moeda: <span className="font-medium text-slate-700">{itinerary.currency_code || "BRL"}</span>
          </p>

          <button
            type="button"
            onClick={() => onOpen(itinerary.id)}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Abrir roteiro
          </button>
        </div>
      </div>
    </article>
  );
}
