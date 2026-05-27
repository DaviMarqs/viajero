import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, MapPinned, Sparkles, Search, PlaneTakeoff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import type { Destination, Itinerary } from "@/types/travel";

type DestinationResponsePayload =
  | Destination
  | Destination[]
  | { results?: Destination[] | Destination; items?: Destination[] | Destination }
  | null
  | undefined;

type DestinationListResponse = ApiSuccessResponse<DestinationResponsePayload>;
type ItineraryResponse = ApiSuccessResponse<Itinerary>;

interface CreationLocationState {
  preferencesId?: number;
}

function readDestinationImage(destination: Destination) {
  return (
    destination.hero_image_url ||
    destination.image_url ||
    destination.image ||
    destination.cover_image ||
    ""
  );
}

function formatDestinationMeta(destination: Destination) {
  return [destination.city, destination.country].filter(Boolean).join(", ");
}

function formatDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDefaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 5);

  const end = new Date(start);
  end.setDate(start.getDate() + 2);

  return {
    start_date: formatDateISO(start),
    end_date: formatDateISO(end),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isDestination(value: unknown): value is Destination {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

function normalizeDestinationList(responseData: unknown): Destination[] {
  if (Array.isArray(responseData)) {
    return responseData.filter(isDestination);
  }

  if (isDestination(responseData)) {
    return [responseData];
  }

  if (typeof responseData === "object" && responseData !== null) {
    if ("results" in responseData) {
      return normalizeDestinationList(responseData.results);
    }

    if ("items" in responseData) {
      return normalizeDestinationList(responseData.items);
    }
  }

  return [];
}

export default function RoteiroCriacaoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as CreationLocationState | null) ?? null;
  const [recommendations, setRecommendations] = useState<Destination[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const [buildingStatus, setBuildingStatus] = useState("Aguardando a busca do destino.");

  const preferencesId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawValue = params.get("preferences_id");

    if (rawValue) {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed)) return parsed;
    }

    return state?.preferencesId ?? null;
  }, [location.search, state]);

  useEffect(() => {
    let active = true;

    async function loadRecommendations() {
      setRecommendationsLoading(true);
      setRecommendationsError(null);

      try {
        const response = await apiRequest<DestinationListResponse>("/api/destinations/");
        if (!active) return;
        const destinations = normalizeDestinationList(response.data).slice(0, 3);
        setRecommendations(destinations);
      } catch (error) {
        if (!active) return;
        setRecommendationsError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as recomendacoes agora.",
        );
      } finally {
        if (active) {
          setRecommendationsLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      active = false;
    };
  }, []);

  async function pollItineraryUntilReady(itineraryId: number | string) {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await apiRequest<ItineraryResponse>(`/api/itineraries/${itineraryId}/`);
      const itinerary = response.data;

      if (!itinerary) {
        throw new Error("Nao foi possivel carregar o roteiro criado.");
      }

      if (itinerary.generation_status === "ready") {
        return itinerary;
      }

      if (itinerary.generation_status === "failed") {
        throw new Error("A geracao do roteiro falhou. Tente novamente.");
      }

      setBuildingStatus("Montando roteiro personalizado. Isso pode levar alguns segundos.");
      await wait(3000);
    }

    throw new Error("O roteiro ainda nao ficou pronto a tempo. Tente abrir novamente em instantes.");
  }

  async function startItineraryGeneration(destination: Destination) {
    setSelectedDestination(destination);
    setBuildingError(null);
    setBuildingStatus("Criando a estrutura inicial do roteiro...");

    try {
      const dates = buildDefaultDates();
      const createResponse = await apiRequest<ItineraryResponse>("/api/itineraries/", {
        method: "POST",
        body: JSON.stringify({
          destination: destination.id,
          title: `${destination.name} 3 dias`,
          duration_days: 3,
          start_date: dates.start_date,
          end_date: dates.end_date,
          currency_code: "BRL",
        }),
      });

      const itinerary = createResponse.data;

      if (!itinerary?.id) {
        throw new Error("Nao foi possivel criar o roteiro.");
      }

      setBuildingStatus("Destino encontrado. Solicitando a geracao do roteiro...");

      await apiRequest(`/api/itineraries/${itinerary.id}/generate/`, {
        method: "POST",
      });

      setBuildingStatus("Roteiro em geracao. Estamos organizando dias e eventos.");

      const readyItinerary = await pollItineraryUntilReady(itinerary.id);
      navigate(`/roteiros/${readyItinerary.id}`);
    } catch (error) {
      setBuildingError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel montar o roteiro agora.",
      );
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchValue.trim();
    if (!query) {
      setSearchError("Digite um destino para pesquisar.");
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSelectedDestination(null);
    setBuildingError(null);
    setBuildingStatus("Buscando destino no banco e nas fontes externas...");

    try {
      const response = await apiRequest<DestinationListResponse>(
        "/api/destinations/search/",
        undefined,
        { q: query },
      );

      const destination = normalizeDestinationList(response.data)[0];

      if (!destination) {
        setSearchError("Nenhum destino foi encontrado com esse nome. Tente outra busca.");
        return;
      }

      await startItineraryGeneration(destination);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel buscar esse destino agora.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  if (selectedDestination) {
    return (
      <section className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-100 px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_24px_80px_rgba(56,189,248,0.12)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <span className="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Destino encontrado
                </span>
                <h1 className="text-3xl font-semibold text-slate-950">
                  {selectedDestination.name}
                </h1>
                <p className="text-sm text-slate-500">
                  {formatDestinationMeta(selectedDestination) || "Destino pronto para geracao"}
                </p>
                {preferencesId ? (
                  <p className="text-xs text-sky-700">
                    Preferencias vinculadas: #{preferencesId}
                  </p>
                ) : null}
              </div>

              {readDestinationImage(selectedDestination) ? (
                <img
                  src={readDestinationImage(selectedDestination)}
                  alt={selectedDestination.name}
                  className="h-32 w-full rounded-3xl object-cover lg:w-56"
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-sky-100 bg-sky-950 px-6 py-8 text-white shadow-[0_24px_80px_rgba(14,116,144,0.24)]">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold">Montando seu roteiro</h2>
                <p className="max-w-2xl text-sm leading-7 text-sky-100">
                  {buildingStatus}
                </p>
                <p className="text-sm text-sky-200">
                  Se esta for a primeira busca desse destino, a etapa de descoberta pode levar entre 5 e 40 segundos.
                </p>
              </div>
            </div>

            {buildingError ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600">
                {buildingError}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-100 px-6 py-8 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[32px] border border-sky-100 bg-white p-8 shadow-[0_24px_80px_rgba(56,189,248,0.12)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Criacao de roteiro
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Escolha um destino para montar sua proxima viagem
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600">
                Pesquise um destino especifico ou use uma das recomendacoes carregadas do banco para iniciar o roteiro.
              </p>
            </div>

            {preferencesId ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                Preferencias recebidas: #{preferencesId}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <article className="rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_18px_60px_rgba(56,189,248,0.10)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <Search className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Pesquisar destino</h2>
                <p className="text-sm text-slate-500">
                  A primeira busca pode demorar. As proximas tendem a responder do cache.
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSearch}>
              <label className="block text-sm font-medium text-slate-700" htmlFor="destination-search">
                Nome do destino
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="destination-search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Ex.: Lisboa, Porto, Salvador"
                  className="h-14 flex-1 rounded-2xl border border-sky-100 bg-sky-50 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="inline-flex h-14 items-center justify-center rounded-2xl bg-sky-600 px-6 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {searchLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    "Buscar destino"
                  )}
                </button>
              </div>
            </form>

            {searchLoading ? (
              <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                <div className="flex items-center gap-3">
                  <Loader2 className="size-4 animate-spin text-sky-600" />
                  <span>Consultando destinos. Essa etapa pode levar entre 5 e 40 segundos.</span>
                </div>
              </div>
            ) : null}

            {searchError ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">
                {searchError}
              </div>
            ) : null}
          </article>

          <article className="rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_18px_60px_rgba(56,189,248,0.10)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Recomendacoes</h2>
                <p className="text-sm text-slate-500">
                  Tres opcoes simples carregadas dos destinos cadastrados.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {recommendationsLoading ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-10 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-3 size-5 animate-spin text-sky-600" />
                  Carregando recomendacoes...
                </div>
              ) : null}

              {!recommendationsLoading && recommendationsError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">
                  {recommendationsError}
                </div>
              ) : null}

              {!recommendationsLoading && !recommendationsError && recommendations.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nenhum destino recomendado foi encontrado no momento.
                </div>
              ) : null}

              {recommendations.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  onClick={() => void startItineraryGeneration(destination)}
                  className="flex w-full flex-col gap-4 rounded-3xl border border-sky-100 bg-sky-50/80 p-4 text-left transition hover:border-sky-300 hover:bg-white"
                >
                  {readDestinationImage(destination) ? (
                    <img
                      src={readDestinationImage(destination)}
                      alt={destination.name}
                      className="h-36 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-950">{destination.name}</h3>
                      <PlaneTakeoff className="size-4 text-sky-600" />
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatDestinationMeta(destination) || "Destino disponivel para roteiro"}
                    </p>
                    <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                      {destination.summary || "Use essa opcao para gerar um roteiro de 3 dias automaticamente."}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </article>
        </div>

        <article className="rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_18px_60px_rgba(56,189,248,0.10)]">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <MapPinned className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Como funciona</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                1. Pesquise o destino ou escolha uma recomendacao. 2. Usamos o primeiro resultado encontrado para criar o roteiro.
                3. Disparamos a geracao e aguardamos o status ficar <strong>ready</strong>. 4. Redirecionamos para a tela final do roteiro.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
