import { useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { useItineraries } from "@/hooks/useItineraries";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import CarouselRow from "@/components/ui/carousel-row";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";

  return "Boa noite";
}

export function Dashboard() {
  const { user, token } = useAuth();
  const { itineraries, loading } = useItineraries(token);
  const navigate = useNavigate();

  const [checkingOnboard, setCheckingOnboard] = useState(false);

  async function handleCreateItinerary() {
    try {
      setCheckingOnboard(true);

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [dnaResponse, preferencesResponse] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/traveler-dna/", {
          method: "GET",
          headers,
        }),

        fetch("http://127.0.0.1:8000/api/trip-preferences/", {
          method: "GET",
          headers,
        }),
      ]);

      if (!dnaResponse.ok || !preferencesResponse.ok) {
        throw new Error("Erro ao validar onboarding");
      }

      console.log("Respostas do onboard:", {
        dnaStatus: dnaResponse.status,
        preferencesStatus: preferencesResponse.status,
      });

      const dnaData = await dnaResponse.json();
      const preferencesData = await preferencesResponse.json();

      console.log("Dados do onboard:", {
        dnaData,
        preferencesData,
      });

      const dnaList = dnaData?.data?.results || [];

      const preferencesList = preferencesData?.data?.results || [];

      const hasTravelerDNA = dnaList.length > 0;

      const hasTripPreferences = preferencesList.length > 0;

      /**
       * Decide rota
       */
      if (!hasTravelerDNA) {
        navigate("/onboard");
        console.log("Usuário sem DNA, redirecionando para onboarding de DNA");
        return;
      }

      if (!hasTripPreferences) {
        navigate("/onboard");
        console.log(
          "Usuário sem preferências, redirecionando para onboarding de preferências",
        );
        return;
      }

      /**
       * Usuário já possui tudo
       */

      console.log(
        "Usuário já completou onboarding, redirecionando para explorar",
      );

      navigate("/explorar");
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingOnboard(false);
    }
  }

  if (!user) return <p>Carregando...</p>;

  return (
    <section className="flex flex-col gap-8 p-8 w-full overflow-x-hidden">
      <div>
        <h1 className="text-4xl font-bold">
          {getGreeting()}, {user.display_name}! 👋
        </h1>

        <p className="text-sm text-neutral-500 mt-1">
          Que tal uma viagem de aventura com clima tropical para sua próxima
          folga?
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Carregando roteiros...</p>
      ) : itineraries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 border border-neutral-200 rounded-2xl py-12 px-6 text-center">
          <div className="bg-neutral-100 p-4 rounded-xl">
            <FileText className="size-6 text-neutral-400" />
          </div>

          <div>
            <h2 className="text-lg font-semibold">Nenhum roteiro salvo</h2>

            <p className="text-sm text-neutral-500 mt-1">
              Explore destinos e salve os que mais combinam com você para
              começar.
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-5 rounded-lg transition-colors"
              onClick={handleCreateItinerary}
              disabled={checkingOnboard}
            >
              {checkingOnboard
                ? "Verificando perfil..."
                : "Criar roteiro do zero"}
            </Button>

            <Button
              variant="outline"
              className="font-semibold px-6 py-5 rounded-lg transition-colors border-neutral-300"
              onClick={() => navigate("/explorar")}
            >
              Explorar destinos
            </Button>
          </div>
        </div>
      ) : (
        <CarouselRow
          title="Meus roteiros"
          itineraries={itineraries}
          onVerTodos={() => navigate("/roteiros")}
          onView={(id) => navigate(`/roteiros/${id}`)}
          onDetails={(id) => navigate(`/roteiros/${id}/detalhes`)}
        />
      )}
    </section>
  );
}
