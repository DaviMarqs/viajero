import { Calendar, Wallet, Clock, MapPin, ArrowRight } from "lucide-react";

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
    return `${currencyCode ?? "$"} ${value}`;
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
  const isReady = itinerary.generation_status === "ready";
  const isGenerating = itinerary.generation_status === "generating";

  return (
    <article 
      onClick={() => onOpen(itinerary.id)}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-blue-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Roteiro
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              isReady ? "bg-green-50 text-green-700" : 
              isGenerating ? "bg-blue-50 text-blue-700 animate-pulse" : 
              "bg-neutral-100 text-neutral-600"
            }`}>
              {formatGenerationStatus(itinerary.generation_status)}
            </span>
          </div>
        </div>

          <div>
          <h3 className="font-['Geist'] text-3xl font-normal tracking-tight text-neutral-900 transition-colors group-hover:text-blue-600">
              {itinerary.title}
            </h3>
          <p className="mt-2 text-base font-medium text-neutral-500">
              {getDestinationLabel(itinerary)}
            </p>
          </div>

        <p className="line-clamp-2 text-base leading-relaxed text-neutral-600">
          {itinerary.summary || "Resumo ainda não disponível para este roteiro."}
          </p>

        <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="flex flex-col gap-1 border-l-2 border-neutral-100 pl-4 transition-colors group-hover:border-blue-200">
            <div className="flex items-center gap-2 text-neutral-400">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Início</span>
            </div>
            <p className="font-['Inter'] text-sm font-semibold text-neutral-900">
              {formatDate(itinerary.start_date)}
            </p>
          </div>

          <div className="flex flex-col gap-1 border-l-2 border-neutral-100 pl-4 transition-colors group-hover:border-blue-200">
            <div className="flex items-center gap-2 text-neutral-400">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Fim</span>
            </div>
            <p className="font-['Inter'] text-sm font-semibold text-neutral-900">
              {formatDate(itinerary.end_date)}
            </p>
          </div>

          <div className="flex flex-col gap-1 border-l-2 border-neutral-100 pl-4 transition-colors group-hover:border-blue-200">
            <div className="flex items-center gap-2 text-neutral-400">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Duração</span>
            </div>
            <p className="font-['Inter'] text-sm font-semibold text-neutral-900">
              {Number(itinerary.duration_days || 0)} dias
            </p>
          </div>

          <div className="flex flex-col gap-1 border-l-2 border-neutral-100 pl-4 transition-colors group-hover:border-blue-200">
            <div className="flex items-center gap-2 text-neutral-400">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Orçamento</span>
            </div>
            <p className="font-['Inter'] text-sm font-semibold text-neutral-900">
              {formatMoney(itinerary.budget_total, itinerary.currency_code)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end border-t border-neutral-100 pt-6">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 transition-colors group-hover:text-blue-600">
            Abrir roteiro
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
