import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useItineraries } from "@/hooks/useItineraries";
import ItineraryCard from "./itinerary-card";

export default function Roteiros() {
  const navigate = useNavigate();
  const { itineraries, loading, error } = useItineraries("mine");

  function handleCreateItinerary() {
    navigate("/onboard/preferências");
  }

  return (
    <main className="min-h-screen bg-white font-['Inter'] text-neutral-900 selection:bg-blue-100 selection:text-blue-900">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-24">
        <header className="mb-12 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-900">
                Meus roteiros
              </span>
            <h1 className="font-['Geist'] text-4xl font-normal tracking-[-0.02em] text-neutral-950 md:text-5xl lg:text-6xl">
                Todos os roteiros criados por você
              </h1>
            <p className="mt-6 text-lg text-neutral-500">
                Acompanhe status de geração, orçamento, período da viagem e abra cada roteiro no detalhe.
              </p>
          </div>

          <Button
            className="inline-flex h-12 items-center justify-center rounded-full bg-blue-600 px-6 font-semibold text-white transition-colors hover:bg-blue-700"
            onClick={handleCreateItinerary}
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo roteiro
          </Button>
        </header>

        {loading ? (
          <section className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[280px] w-full animate-pulse rounded-2xl bg-neutral-100"
              />
            ))}
          </section>
        ) : error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
            {error}
          </section>
        ) : itineraries.length === 0 ? (
          <section className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 py-24 text-center">
            <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
              <FileText className="h-8 w-8 text-neutral-400" />
            </div>

            <div>
              <h2 className="font-['Geist'] text-2xl font-normal text-neutral-900">
                Nenhum roteiro criado ainda
              </h2>
              <p className="mt-2 text-neutral-500">
                Gere seu primeiro roteiro para ver os dias e eventos aqui.
              </p>
            </div>

            <Button
              className="mt-6 rounded-full bg-blue-600 px-8 hover:bg-blue-700"
              onClick={handleCreateItinerary}
            >
              Criar meu primeiro roteiro
            </Button>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <p className="text-sm font-medium text-neutral-500">
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
