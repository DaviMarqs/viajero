import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Calendar,
  Wallet,
  Share,
  Heart,
  Clock,
  ArrowLeft,
  CheckCircle,
  Loader2,
} from "lucide-react";

import { apiRequest } from "@/lib/api";

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

export interface ItineraryEvent {
  id?: number;
  poi_id?: number | null;
  title: string;
  description: string;
  start_time?: string;
  end_time?: string;
  estimated_cost?: string;
  order_index?: number;
}

export interface ItineraryDay {
  id?: number;
  day_number?: number;
  title: string;
  summary: string;
  events?: ItineraryEvent[];
}

export interface Itinerary {
  id: number;
  title: string;
  summary?: string;
  destination_name?: string;
  destination?: any;
  duration_days: number;
  budget_total: string;
  currency_code: string;
  generation_status: "draft" | "generating" | "ready" | "failed";
}

export default function ItineraryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItineraryData = async () => {
      if (!id) {
        setError("ID do roteiro inválido.");
        setLoading(false);
        return;
      }

      try {
        const [itJson, daysJson] = await Promise.all([
          apiRequest<any>(`/api/itineraries/${id}/`),
          apiRequest<any>(`/api/itineraries/${id}/days/`).catch(() => ({ data: [] })),
        ]);

        setItinerary(itJson.data || itJson);
        const fetchedDays = Array.isArray(daysJson)
          ? daysJson
          : Array.isArray(daysJson.data) ? daysJson.data
          : daysJson.data?.results || daysJson.results || itJson.data?.days || itJson.days || [];
        setDays(fetchedDays);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Ocorreu um erro inesperado ao conectar com a API.";
            
        if (errorMessage.includes("401") || errorMessage.toLowerCase().includes("unauthorized")) {
          navigate("/login");
          return;
        }
        
        if (errorMessage.includes("404")) {
          setError("Roteiro não encontrado.");
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchItineraryData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="font-['Inter'] text-neutral-500">
          {error || "Roteiro não encontrado."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-['Inter'] text-neutral-900 selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-10 flex h-16 items-center border-b border-neutral-200 bg-white/80 px-6 backdrop-blur-md lg:px-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center rounded-full pr-4 transition-colors hover:bg-neutral-100"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="h-5 w-5 text-neutral-900" />
          </div>
          <span className="ml-2 font-['Inter'] text-sm font-medium text-neutral-500">
            Voltar para Roteiros
          </span>
        </button>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-24">
        {/* Hero Section */}
        <header className="mb-16 max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-900">
              <MapPin className="h-3.5 w-3.5" />
              {typeof itinerary.destination === "object"
                ? itinerary.destination?.name
                : itinerary.destination_name || "Destino"}
            </span>
            {itinerary.generation_status === "ready" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                <CheckCircle className="h-3.5 w-3.5" />
                Gerado por IA
              </span>
            )}
          </div>

          <h1 className="mb-6 font-['Geist'] text-5xl font-normal tracking-[-0.03em] text-neutral-950 md:text-6xl lg:text-[64px] lg:leading-[0.95]">
            {itinerary.title}
          </h1>

          <p className="text-lg leading-relaxed text-neutral-600 md:text-xl">
            {itinerary.summary ||
              "Roteiro em processo de detalhamento pela inteligência artificial..."}
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-12 lg:gap-24">
          <div className="lg:col-span-8">
            <div className="flex flex-col gap-16">
              {days.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
                  <p className="text-neutral-500">
                    Os dias do roteiro ainda não estão disponíveis.
                  </p>
                </div>
              ) : (
              days.map((day: ItineraryDay, index: number) => (
                <section key={day.id || day.day_number || index} className="relative">
                    <div className="mb-8 flex flex-col gap-2">
                      <h2 className="font-['Geist'] text-3xl font-normal tracking-tight text-neutral-900 md:text-4xl">
                      Dia {day.day_number || index + 1}
                      </h2>
                      <h3 className="mt-2 font-['Geist'] text-xl font-normal text-neutral-500">
                        {day.title}
                      </h3>
                      <p className="mt-4 text-base text-neutral-900">
                        {day.summary}
                      </p>
                    </div>

                    <div className="relative pl-4 md:pl-0">
                      <div className="absolute bottom-0 left-[23px] top-2 hidden w-px bg-neutral-200 md:block" />

                      <div className="flex flex-col gap-8">
                        {day.events?.map(
                          (event: ItineraryEvent, eventIdx: number) => (
                            <div
                              key={eventIdx}
                              className="relative flex flex-col gap-4 md:flex-row md:gap-8"
                            >
                              <div className="relative hidden w-24 shrink-0 pt-1 md:block">
                                <div className="absolute right-[-21px] top-[9px] h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" />
                                <span className="font-mono text-sm font-medium text-neutral-500">
                                  {event.start_time}
                                </span>
                              </div>

                              <div className="group flex-1 rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                                <div className="mb-4 flex items-start justify-between gap-4">
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 md:hidden">
                                      <Clock className="h-4 w-4 text-neutral-400" />
                                      <span className="font-mono text-sm font-medium text-neutral-500">
                                        {event.start_time}
                                      </span>
                                    </div>
                                    <h4 className="font-['Geist'] text-xl font-normal tracking-tight text-neutral-900">
                                      {event.title}
                                    </h4>
                                  </div>
                                  <span className="shrink-0 text-base font-semibold [&.group-hover] text-blue-600">
                                    {event.estimated_cost &&
                                    event.estimated_cost !== "0.00"
                                      ? formatMoney(event.estimated_cost, itinerary.currency_code)
                                      : "Grátis"}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed text-neutral-600">
                                  {event.description}
                                </p>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-24 rounded-[24px] bg-neutral-50 p-8">
              <h3 className="mb-6 font-['Geist'] text-2xl font-normal tracking-tight text-neutral-900">
                Resumo da Viagem
              </h3>

              <div className="mb-8 flex flex-col gap-5 pt-6">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-5">
                  <div className="flex items-center gap-3 text-neutral-600">
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm">Duração</span>
                  </div>
                  <span className="font-medium text-neutral-900">
                    {itinerary.duration_days} dias
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-neutral-200 pb-5">
                  <div className="flex items-center gap-3 text-neutral-600">
                    <Wallet className="h-5 w-5" />
                    <span className="text-sm">Orçamento Estimado</span>
                  </div>
                  <span className="font-mono font-medium text-neutral-900">
                    {formatMoney(itinerary.budget_total, itinerary.currency_code)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 font-['Inter'] text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                  <Heart className="h-4 w-4" />
                  Salvar nos Favoritos
                </button>

                <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-transparent px-6 font-['Inter'] text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100">
                  <Share className="h-4 w-4" />
                  Compartilhar
                </button>
              </div>

              <div className="mt-8 rounded-xl bg-white p-4 text-xs text-neutral-500">
                <p>
                  <strong>Nota:</strong> Os custos são estimativas baseadas no
                  perfil do seu <i>Traveler DNA</i>. Recomendamos verificar os
                  valores diretamente nos locais, pois podem sofrer alterações.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
