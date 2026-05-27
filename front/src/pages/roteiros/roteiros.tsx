import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useItineraries } from "@/hooks/useItineraries";
import ItineraryCard from "./itinerary-card";

export default function Roteiros() {
  const navigate = useNavigate();
  const { itineraries, loading, error } = useItineraries("mine");

  function handleCreateItinerary() {
    navigate("/onboard/preferencias");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
        <section className="rounded-[32px] border border-sky-100 bg-white p-8 shadow-[0_18px_60px_rgba(56,189,248,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Meus roteiros
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Todos os itinerarios criados por voce
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Acompanhe status de geracao, orcamento, periodo da viagem e abra cada roteiro no detalhe.
              </p>
            </div>

            <Button
              className="h-12 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
              onClick={handleCreateItinerary}
            >
              <Plus className="mr-2 size-4" />
              Criar novo roteiro
            </Button>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[28px] border border-sky-100 bg-white px-6 py-10 text-sm text-slate-500 shadow-[0_18px_60px_rgba(56,189,248,0.08)]">
            Carregando roteiros...
          </section>
        ) : error ? (
          <section className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
            {error}
          </section>
        ) : itineraries.length === 0 ? (
          <section className="flex flex-col items-center gap-4 rounded-[28px] border border-sky-100 bg-white px-6 py-12 text-center shadow-[0_18px_60px_rgba(56,189,248,0.08)]">
            <div className="rounded-2xl bg-sky-50 p-4">
              <FileText className="size-6 text-sky-500" />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Nenhum roteiro criado ainda
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Gere seu primeiro roteiro para ver os dias e eventos aqui.
              </p>
            </div>

            <Button
              className="mt-2 rounded-2xl bg-sky-600 px-6 py-5 font-semibold text-white hover:bg-sky-700"
              onClick={handleCreateItinerary}
            >
              Criar roteiro
            </Button>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-slate-500">
                {itineraries.length} roteiro(s) encontrado(s)
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {itineraries.map((itinerary) => (
                <ItineraryCard
                  key={itinerary.id}
                  itinerary={itinerary}
                  onOpen={(id) => navigate(`/roteiros/${id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
