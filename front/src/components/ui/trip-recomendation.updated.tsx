import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  MapPin,
  Sparkles,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";

export type TripRecommendation = {
  id: number;
  title: string;
  destinationName: string;
  destinationSlug: string;
  country: string;
  summary: string;
  imageUrl: string;
  durationDays: number;
  budgetTotal: number;
  currencyCode: string;
  rating: number;
  bestSeason: string;
  travelStyle: string;
  generationStatus: "draft" | "generating" | "ready" | "failed";
  tags: string[];
  highlights: string[];
};

type TripRecomendationProps = {
  trip: TripRecommendation;
};

const statusLabel: Record<TripRecommendation["generationStatus"], string> = {
  draft: "Rascunho",
  generating: "Gerando",
  ready: "Pronto",
  failed: "Falhou",
};

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TripRecomendation({ trip }: TripRecomendationProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
      <div className="relative h-52 overflow-hidden bg-blue-100">
        <img
          src={trip.imageUrl}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          alt={`Imagem do roteiro ${trip.title}`}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-neutral-800 shadow-sm">
            {statusLabel[trip.generationStatus]}
          </span>

          <span className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
            <Sparkles size={13} />
            {trip.travelStyle}
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-1 text-sm text-white/90">
            <MapPin size={15} />
            <span>
              {trip.destinationName}, {trip.country}
            </span>
          </div>

          <h3 className="mt-1 line-clamp-2 text-2xl font-medium leading-tight text-white">
            {trip.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="mb-1 flex items-center gap-1 text-neutral-500">
              <CalendarDays size={14} />
              <span className="text-xs">Duração</span>
            </div>
            <p className="text-sm font-medium text-neutral-900">
              {trip.durationDays} dias
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="mb-1 flex items-center gap-1 text-neutral-500">
              <CircleDollarSign size={14} />
              <span className="text-xs">Budget</span>
            </div>
            <p className="text-sm font-medium text-neutral-900">
              {formatCurrency(trip.budgetTotal, trip.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="mb-1 flex items-center gap-1 text-neutral-500">
              <Star size={14} />
              <span className="text-xs">Nota</span>
            </div>
            <p className="text-sm font-medium text-neutral-900">
              {trip.rating.toFixed(1)}
            </p>
          </div>
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-neutral-600">
          {trip.summary}
        </p>

        <div className="flex flex-wrap gap-2">
          {trip.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-900">
            <Clock3 size={16} />
            Destaques do roteiro
          </div>

          <div className="flex flex-wrap gap-2">
            {trip.highlights.map((highlight) => (
              <span
                key={highlight}
                className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700"
              >
                {highlight}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Melhor época: {trip.bestSeason}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
          <Link
            to={`/destinos/${trip.id}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Ver roteiro
          </Link>

          <Link
            to={`/destinos/${trip.destinationSlug}`}
            className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Ver destino
          </Link>
        </div>
      </div>
    </article>
  );
}
