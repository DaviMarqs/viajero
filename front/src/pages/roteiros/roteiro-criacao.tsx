import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  Sparkles,
  Search,
  PlaneTakeoff,
  Wand2,
  MapPin,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRequest } from "@/lib/api";
import type { ApiSuccessResponse } from "@/lib/api";
import type { Destination, Itinerary } from "@/types/travel";

type DestinationResponsePayload =
  | Destination
  | Destination[]
  | {
      results?: Destination[] | Destination;
      items?: Destination[] | Destination;
    }
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

function buildItineraryDates(durationDays: number) {
  const start = new Date();
  start.setDate(start.getDate() + 5);

  const safeDays =
    Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 5;
  const end = new Date(start);
  end.setDate(start.getDate() + safeDays - 1);

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
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] =
    useState<Destination | null>(null);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const [buildingStatus, setBuildingStatus] = useState(
    "Aguardando a busca do destino.",
  );

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
        const response =
          await apiRequest<DestinationListResponse>("/api/destinations/");
        if (!active) return;
        const destinations = normalizeDestinationList(response.data).slice(
          0,
          3,
        );
        setRecommendations(destinations);
      } catch (error) {
        if (!active) return;
        setRecommendationsError(
          error instanceof Error
            ? error.message
            : "Nao foi possível carregar as recomendações agora.",
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

  const autoSuggestTriggered = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("auto") !== "destino" || autoSuggestTriggered.current) {
      return;
    }
    autoSuggestTriggered.current = true;
    void handleSuggestDestination();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function pollItineraryUntilReady(itineraryId: number | string) {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await apiRequest<ItineraryResponse>(
        `/api/itineraries/${itineraryId}/`,
      );
      const itinerary = response.data;

      if (!itinerary) {
        throw new Error("Nao foi possivel carregar o roteiro criado.");
      }

      if (itinerary.generation_status === "ready") {
        return itinerary;
      }

      if (itinerary.generation_status === "failed") {
        throw new Error("A geração do roteiro falhou. Tente novamente.");
      }

      setBuildingStatus(
        "Montando roteiro personalizado. Isso pode levar alguns segundos.",
      );
      await wait(3000);
    }

    throw new Error(
      "O roteiro ainda nao ficou pronto a tempo. Tente abrir novamente em instantes.",
    );
  }

  async function startItineraryGeneration(destination: Destination) {
    setSelectedDestination(destination);
    setBuildingError(null);
    setSearchValue(""); // Limpa o input para evitar enviesar a próxima busca
    setBuildingStatus("Criando a estrutura inicial do roteiro...");

    try {
      const createResponse = await apiRequest<ItineraryResponse>(
        "/api/itineraries/",
        {
          method: "POST",
          body: JSON.stringify({
            destination: destination.id,
            title: destination.name,
          }),
        },
      );

      const itinerary = createResponse.data;

      if (!itinerary?.id) {
        throw new Error("Nao foi possivel criar o roteiro.");
      }

      const dates = buildItineraryDates(Number(itinerary.duration_days ?? 5));
      await apiRequest(`/api/itineraries/${itinerary.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          start_date: dates.start_date,
          end_date: dates.end_date,
        }),
      });

      setBuildingStatus(
        "Destino encontrado. Solicitando a geração do roteiro...",
      );

      await apiRequest(`/api/itineraries/${itinerary.id}/generate/`, {
        method: "POST",
      });

      setBuildingStatus(
        "Roteiro em geração. Estamos organizando dias e eventos.",
      );

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

  async function handleSuggestDestination() {
    if (searchLoading || suggestLoading) return;

    setSuggestLoading(true);
    setSearchError(null);
    setSelectedDestination(null);
    setBuildingError(null);
    setBuildingStatus("Escolhendo um destino com base no seu perfil...");

    try {
      const response = await apiRequest<DestinationListResponse>(
        "/api/destinations/suggest/",
        { method: "POST" },
      );

      const destination = normalizeDestinationList(response.data)[0];

      if (!destination) {
        setSearchError(
          "Nao foi possivel gerar um destino agora. Tente novamente em instantes.",
        );
        return;
      }

      await startItineraryGeneration(destination);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel gerar um destino agora.",
      );
    } finally {
      setSuggestLoading(false);
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
        setSearchError(
          "Nenhum destino foi encontrado com esse nome. Tente outra busca.",
        );
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
      <div className="min-h-screen bg-white font-['Inter'] text-neutral-900 selection:bg-blue-100 selection:text-blue-900">
        <main className="mx-auto max-w-4xl px-6 py-16 lg:px-12 lg:py-24">
          <div className="flex flex-col gap-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-900">
                    <MapPin className="h-3.5 w-3.5" />
                    Destino encontrado
                  </span>
                  <h1 className="font-['Geist'] text-4xl font-normal tracking-tight text-neutral-950 md:text-5xl">
                    {selectedDestination.name}
                  </h1>
                  <p className="text-base text-neutral-500">
                    {formatDestinationMeta(selectedDestination) ||
                      "Destino pronto para geração"}
                  </p>
                  {preferencesId ? (
                    <p className="text-sm font-medium text-blue-600">
                      Preferências vinculadas: #{preferencesId}
                    </p>
                  ) : null}
                </div>

                {readDestinationImage(selectedDestination) ? (
                  <img
                    src={readDestinationImage(selectedDestination)}
                    alt={selectedDestination.name}
                    className="h-40 w-full rounded-xl object-cover lg:w-64"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-8 py-10">
              <div className="flex items-start gap-6">
                <div className="rounded-full bg-blue-100 p-4 text-blue-600">
                  <Loader2 className="size-6 animate-spin" />
                </div>
                <div className="space-y-3">
                  <h2 className="font-['Geist'] text-3xl font-normal tracking-tight text-neutral-900">
                    Montando seu roteiro
                  </h2>
                  <p className="max-w-2xl text-base leading-relaxed text-neutral-600">
                    {buildingStatus}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Se esta for a primeira busca desse destino, a etapa de
                    descoberta pode levar entre 5 e 40 segundos.
                  </p>
                </div>
              </div>

              {buildingError ? (
                <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {buildingError}
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-['Inter'] text-neutral-900 selection:bg-blue-100 selection:text-blue-900">
      <main className="mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-24">
        <header className="mb-16 max-w-3xl">
          <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-900">
              Criação de roteiro
            </span>
            {preferencesId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-transparent px-3 py-1 text-xs font-semibold tracking-wide text-blue-600">
                Preferências: #{preferencesId}
              </span>
            ) : null}
          </div>

          <h1 className="mb-6 font-['Geist'] text-5xl font-normal tracking-[-0.03em] text-neutral-950 md:text-6xl lg:text-[64px] lg:leading-[0.95]">
            Escolha um destino para montar sua próxima viagem
          </h1>
        </header>

        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-12 lg:gap-24">
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 transition-shadow hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <div className="mb-8 flex items-center gap-3">
                <div className="rounded-xl bg-neutral-100 p-3 text-neutral-600">
                  <Search className="size-5" />
                </div>
                <h2 className="font-['Geist'] text-2xl font-normal tracking-tight text-neutral-900">
                  Pesquisar destino
                </h2>
              </div>

              <form className="space-y-4" onSubmit={handleSearch}>
                <label
                  className="block text-sm font-medium text-neutral-700"
                  htmlFor="destination-search"
                >
                  Nome do destino
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="destination-search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Ex.: Lisboa, Porto, Salvador"
                    className="h-12 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading || suggestLoading}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
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
                 <p className="pt-3 text-center text-xs leading-relaxed text-neutral-500">
              Utilize essa opção caso já tenha um destino específico em mente!
            </p>
              </form>

              <div className="my-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <span className="h-px flex-1 bg-neutral-200" />
                ou
                <span className="h-px flex-1 bg-neutral-200" />
              </div>

              <button
                type="button"
                onClick={() => void handleSuggestDestination()}
                disabled={searchLoading || suggestLoading}
                className="group relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/20" />
                </div>
                <span className="relative flex items-center gap-2">
                  {suggestLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Gerando destino...
                    </>
                  ) : (
                    <>
                      <Wand2 className="size-4 text-white" />
                      Gerar destino pra mim
                    </>
                  )}
                </span>
              </button>
              <p className="pt-3 text-center text-xs leading-relaxed text-neutral-500">
                Deixe a gente escolher um destino com base no seu perfil e nas
                suas preferências de viagem.
              </p>

              {searchLoading || suggestLoading ? (
                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-4 animate-spin text-blue-600" />
                    <span>
                      {suggestLoading
                        ? "Escolhendo um destino para você. Essa etapa pode levar entre 5 e 40 segundos."
                        : "Consultando destinos. Essa etapa pode levar entre 5 e 40 segundos."}
                    </span>
                  </div>
                </div>
              ) : null}

              {searchError ? (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">
                  {searchError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-2xl border border-neutral-200 bg-neutral-50 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-white p-3 text-blue-600 shadow-sm border border-neutral-100">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="font-['Geist'] text-2xl font-normal tracking-tight text-neutral-900">
                    Recomendações
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Opções prontas da nossa base.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {recommendationsLoading ? (
                  <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                    <Loader2 className="mx-auto mb-3 size-5 animate-spin text-blue-600" />
                    Carregando recomendações...
                  </div>
                ) : null}

                {!recommendationsLoading && recommendationsError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">
                    {recommendationsError}
                  </div>
                ) : null}

                {!recommendationsLoading &&
                !recommendationsError &&
                recommendations.length === 0 ? (
                  <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-500">
                    Nenhum destino recomendado foi encontrado no momento.
                  </div>
                ) : null}

                {recommendations.map((destination) => (
                  <button
                    key={destination.id}
                    type="button"
                    onClick={() => void startItineraryGeneration(destination)}
                    className="group flex w-full flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-blue-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
                  >
                    {readDestinationImage(destination) ? (
                      <img
                        src={readDestinationImage(destination)}
                        alt={destination.name}
                        className="h-32 w-full rounded-lg object-cover transition-opacity group-hover:opacity-90"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-['Geist'] text-lg font-normal text-neutral-900">
                          {destination.name}
                        </h3>
                        <PlaneTakeoff className="size-4 text-neutral-400 transition-colors group-hover:text-blue-600" />
                      </div>
                      <p className="text-xs text-neutral-500">
                        {formatDestinationMeta(destination) ||
                          "Destino disponível para roteiro"}
                      </p>
                      <p className="line-clamp-2 text-sm leading-relaxed text-neutral-600">
                        {destination.summary ||
                          "Use essa opcao para gerar um roteiro de 3 dias automaticamente."}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
