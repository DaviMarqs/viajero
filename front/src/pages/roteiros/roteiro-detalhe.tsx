import { useEffect, useState } from "react";
import { CalendarDays, Coins, Loader2, MapPinned } from "lucide-react";
import { useParams } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import type { Itinerary } from "@/types/travel";

type ItineraryResponse = ApiSuccessResponse<Itinerary>;

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

function formatDate(value?: string | null) {
  if (!value) return "Nao informado";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export default function RoteiroDetalhePage() {
  const { id } = useParams();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!id) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
          Roteiro nao informado.
        </div>
      </section>
    );
  }

  useEffect(() => {
    let active = true;
    let intervalId: number | null = null;

    async function loadItinerary() {
      try {
        const response = await apiRequest<ItineraryResponse>(`/api/itineraries/${id}/`);
        if (!active) return;

        const nextItinerary = response.data ?? null;
        setItinerary(nextItinerary);
        setError(null);

        if (
          nextItinerary?.generation_status &&
          nextItinerary.generation_status !== "ready" &&
          nextItinerary.generation_status !== "failed" &&
          intervalId === null
        ) {
          intervalId = window.setInterval(() => {
            void loadItinerary();
          }, 4000);
        }

        if (
          nextItinerary?.generation_status === "ready" ||
          nextItinerary?.generation_status === "failed"
        ) {
          if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (nextError) {
        if (!active) return;
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Nao foi possivel carregar o roteiro.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadItinerary();

    return () => {
      active = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [id]);

  if (loading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] border border-sky-100 bg-white">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="size-6 animate-spin text-sky-600" />
            <span>Carregando roteiro...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
          {error}
        </div>
      </section>
    );
  }

  if (!itinerary) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-500">
          Nenhum roteiro foi encontrado para esse identificador.
        </div>
      </section>
    );
  }

  const days = itinerary.days ?? [];
  const destinationLabel =
    typeof itinerary.destination === "object" && itinerary.destination
      ? itinerary.destination.name
      : itinerary.destination_name;

  return (
    <section className="min-h-screen bg-slate-50 px-6 py-8 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[32px] border border-sky-100 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Roteiro #{itinerary.id}
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                {itinerary.title}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {itinerary.summary || "Resumo ainda nao disponivel para este roteiro."}
              </p>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Status: <strong>{itinerary.generation_status || "desconhecido"}</strong>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-sky-100 bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-sky-100 p-3 text-sky-700">
              <CalendarDays className="size-5" />
            </div>
            <p className="text-sm text-slate-500">Periodo</p>
            <p className="mt-1 font-semibold text-slate-950">
              {formatDate(itinerary.start_date)} - {formatDate(itinerary.end_date)}
            </p>
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-sky-100 p-3 text-sky-700">
              <MapPinned className="size-5" />
            </div>
            <p className="text-sm text-slate-500">Destino</p>
            <p className="mt-1 font-semibold text-slate-950">
              {destinationLabel || "Nao informado"}
            </p>
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-sky-100 p-3 text-sky-700">
              <Coins className="size-5" />
            </div>
            <p className="text-sm text-slate-500">Orcamento</p>
            <p className="mt-1 font-semibold text-slate-950">
              {formatMoney(itinerary.budget_total, itinerary.currency_code)}
            </p>
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-white p-5">
            <div className="mb-3 inline-flex rounded-2xl bg-sky-100 p-3 text-sky-700">
              <CalendarDays className="size-5" />
            </div>
            <p className="text-sm text-slate-500">Duracao</p>
            <p className="mt-1 font-semibold text-slate-950">
              {itinerary.duration_days || 0} dias
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Dias do roteiro</h2>

          {days.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Ainda nao existem dias gerados para este roteiro.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {days.map((day) => {
                const events = day.events ?? [];

                return (
                <article
                  key={day.id}
                  className="rounded-[24px] border border-sky-100 bg-sky-50/60 p-5"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                        Dia {day.day_number}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">
                        {day.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {day.summary || "Sem resumo para este dia."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-600">
                      Custo estimado: {formatMoney(day.estimated_cost, itinerary.currency_code)}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {events.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        Nenhum evento foi adicionado neste dia.
                      </div>
                    ) : (
                      events.map((eventItem) => (
                        <div
                          key={eventItem.id}
                          className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h4 className="text-base font-semibold text-slate-950">
                                {eventItem.title}
                              </h4>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {eventItem.description || "Sem descricao para este evento."}
                              </p>
                            </div>

                            <div className="text-sm text-slate-500">
                              {eventItem.start_time || "--:--"} - {eventItem.end_time || "--:--"}
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-slate-500">
                            Custo estimado: {formatMoney(eventItem.estimated_cost, itinerary.currency_code)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
