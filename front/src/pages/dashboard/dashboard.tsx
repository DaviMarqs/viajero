import { useNavigate } from "react-router-dom";
import { FileText, Plus, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/authContext";
import { useItineraries } from "@/hooks/useItineraries";
import ItineraryCard from "@/pages/roteiros/itinerary-card";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";

  return "Boa noite";
}

export function Dashboard() {
  const { user } = useAuth();
  const { itineraries, loading, error } = useItineraries();
  const navigate = useNavigate();
  const recentItineraries = itineraries.slice(0, 3);

  function handleCreateItinerary() {
    navigate("/onboard/preferências");
  }

  function handleSuggestItinerary() {
    navigate("/roteiros/criacao?auto=destino");
  }

  if (!user) {
    return <p className="p-8 text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <section className="flex w-full flex-col gap-8 overflow-x-hidden p-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-950">
          {getGreeting()}, {user.display_name}!
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Seus roteiros ficam organizados aqui para você continuar o planejamento de cada viagem.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-[28px] border border-sky-100 bg-white px-6 py-5 shadow-[0_18px_60px_rgba(56,189,248,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Seus roteiros
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Abra um roteiro existente ou inicie uma nova geração.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="h-12 rounded-2xl border-sky-200 bg-sky-50 px-5 text-sm font-semibold text-sky-700 hover:bg-sky-100"
            onClick={handleSuggestItinerary}
          >
            <Wand2 className="mr-2 size-4" />
            Gerar destino pra mim
          </Button>

          <Button
            className="h-12 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
            onClick={handleCreateItinerary}
          >
            <Plus className="mr-2 size-4" />
            Criar novo roteiro
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-sky-100 bg-white px-6 py-10 text-sm text-slate-500 shadow-[0_18px_60px_rgba(56,189,248,0.08)]">
          Carregando roteiros...
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
          {error}
        </div>
      ) : itineraries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-sky-100 bg-white px-6 py-12 text-center shadow-[0_18px_60px_rgba(56,189,248,0.08)]">
          <div className="rounded-2xl bg-sky-50 p-4">
            <FileText className="size-6 text-sky-500" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Nenhum roteiro salvo
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Salve suas preferências e gere o primeiro roteiro para comecar.
            </p>
          </div>

          <Button
            className="mt-2 rounded-2xl bg-sky-600 px-6 py-5 font-semibold text-white transition-colors hover:bg-sky-700"
            onClick={handleCreateItinerary}
          >
            Criar roteiro
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {itineraries.length} roteiro(s) encontrado(s)
            </p>

            <button
              type="button"
              onClick={() => navigate("/roteiros")}
              className="text-sm font-semibold text-sky-700 transition hover:text-sky-800"
            >
              Ver todos
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {recentItineraries.map((itinerary) => (
              <ItineraryCard
                key={itinerary.id}
                itinerary={itinerary}
                onOpen={(id) => navigate(`/roteiros/${id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
