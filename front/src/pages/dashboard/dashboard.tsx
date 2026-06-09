import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wand2, Sparkles, Map, Calendar, Wallet, ChevronLeft, ChevronRight } from "lucide-react";

import { useAuth } from "@/contexts/authContext";
import { useItineraries } from "@/hooks/useItineraries";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";

  return "Boa noite";
}

function ItineraryImage({ itinerary }: { itinerary: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const dest = typeof itinerary.destination === 'object' ? itinerary.destination : itinerary.destination_details;
    const destId = typeof itinerary.destination === 'number' ? itinerary.destination : dest?.id;

    const resolveImage = async () => {
      let finalImg = dest?.hero_image_url || dest?.hero_image;
      let destName = dest?.name || itinerary.title;

      if (!finalImg && destId) {
        try {
          const token = localStorage.getItem('access') || localStorage.getItem('token') || localStorage.getItem('access_token');
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
          const res = await fetch(`${baseUrl}/api/destinations/${destId}/`, { headers });
          if (res.ok) {
            const data = await res.json();
            const destData = data?.data || data;
            finalImg = destData?.hero_image_url || destData?.hero_image;
            if (destData?.name) destName = destData.name;
          }
        } catch (e) {
          console.error("Erro ao buscar imagem do destino no backend", e);
        }
      }

      if (!finalImg && destName) {
        try {
          const cleanName = destName.replace(/ \d+ dias/i, '').split(' - ')[0]; // Limpa nomes como "Floripa 5 dias"
          const wikiRes = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            finalImg = wikiData.thumbnail?.source || wikiData.originalimage?.source;
          }
        } catch (e) {
          console.error("Erro no fallback da Wikipedia", e);
        }
      }

      if (isMounted && finalImg) {
        setImageUrl(finalImg);
      }
    };

    resolveImage();
    return () => { isMounted = false; };
  }, [itinerary]);

  const fallbackImage = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80";

  return (
    <img
      src={imageUrl || fallbackImage}
      alt={itinerary.title}
      className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
    />
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { itineraries, loading, error } = useItineraries();
  const navigate = useNavigate();
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 344; // Aproximadamente a largura do card + gap
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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
    <div className="min-h-screen bg-white font-['Inter'] pb-24 selection:bg-blue-100 selection:text-blue-900">
      {/* Hero Section & Actions Pill */}
      <section className="relative px-6 pt-12 pb-16 md:pt-20 md:pb-24 max-w-[1080px] mx-auto flex flex-col items-center text-center">
        <h1 className="font-['Geist'] text-4xl md:text-4xl lg:text-5xl leading-[1.1] font-semibold tracking-tighter text-slate-900 mb-10 max-w-4xl">
          {getGreeting()}, {user.display_name}!<br />
        </h1>
        <h2 className="text-3xl pt-3 leading-[1.1] ">
          Para onde sua próxima{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
            história
          </span>{" "}
          vai te levar?
        </h2>

        <div className="group flex flex-col md:flex-row items-center bg-white rounded-3xl md:rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 p-2 mt-10 md:pl-6 max-w-[800px] w-full transition-all duration-500 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)] hover:-translate-y-1">
          <button
            onClick={handleSuggestItinerary}
            className="flex-1 flex items-center gap-4 text-left px-4 border-b md:border-b-0 md:border-r border-slate-100 hover:bg-slate-50 rounded-t-2xl md:rounded-l-full md:rounded-tr-none py-3 transition-colors w-full"
          >
            <div className="bg-blue-50 p-2.5 rounded-full text-blue-600">
              <Wand2 size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-slate-800 uppercase font-['Geist'] mb-0.5">
                Sugerir roteiro 
              </div>
              <div className="text-[14px] text-slate-500 font-medium font-['Inter']">
                Gerar com IA
              </div>
            </div>
          </button>

          <button
            onClick={handleCreateItinerary}
            className="flex-1 flex items-center gap-4 text-left px-6 border-b md:border-b-0 border-slate-100 hover:bg-slate-50 py-3 transition-colors w-full"
          >
            <div className="bg-blue-50 p-2.5 rounded-full text-blue-600">
              <Plus size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-slate-800 uppercase font-['Geist'] mb-0.5">
                Personalizado
              </div>
              <div className="text-[14px] text-slate-500 font-medium font-['Inter']">
                Criar novo roteiro
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto px-6 md:px-12">
        <div className="space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-['Geist'] text-2xl font-semibold tracking-tight text-slate-900">
                Seus roteiros
              </h2>
              <p className="mt-1 text-sm text-slate-500 font-['Inter']">
                Continue o planejamento de suas viagens salvas.
              </p>
            </div>
            {itineraries.length > 0 && (
              <div className="flex items-center gap-4 mb-1">
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); scroll('left'); }}
                    className="p-2 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none"
                  >
                    <ChevronLeft size={18} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); scroll('right'); }}
                    className="p-2 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none"
                  >
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/roteiros")}
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-800 font-['Inter']"
                >
                  Ver todos ({itineraries.length})
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex overflow-x-auto gap-6 pb-6 pt-2 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col justify-between animate-pulse flex-none w-[85vw] sm:w-[320px] h-[216px] snap-start rounded-[24px] border border-slate-100 bg-white p-6">
                  <div className="flex flex-col gap-4">
                    <div className="h-6 w-24 rounded-full bg-slate-100"></div>
                    <div className="flex flex-col gap-2">
                      <div className="h-5 w-3/4 rounded bg-slate-100"></div>
                      <div className="h-4 w-full rounded bg-slate-100 mt-2"></div>
                      <div className="h-4 w-2/3 rounded bg-slate-100"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                    <div className="h-4 w-16 rounded bg-slate-100"></div>
                    <div className="h-4 w-20 rounded bg-slate-100"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
              Ocorreu um erro: {error}
            </div>
          ) : itineraries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
              <div className="rounded-full bg-blue-50 p-4">
                <Map className="size-8 text-blue-600" />
              </div>
              <div>
                <h2 className="font-['Geist'] text-xl font-semibold text-slate-900">
                  Nenhum roteiro salvo
                </h2>
                <p className="mt-2 text-[15px] text-slate-500 max-w-sm font-['Inter']">
                  Salve suas preferências e crie seu primeiro roteiro para
                  começar sua próxima grande aventura.
                </p>
              </div>
              <button
                className="mt-4 rounded-full bg-blue-600 px-8 py-4 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:-translate-y-0.5"
                onClick={handleCreateItinerary}
              >
                Começar a planejar
              </button>
            </div>
          ) : (
            <div 
              ref={carouselRef}
              className="flex overflow-x-auto gap-6 pb-8 pt-2 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {itineraries.map((itinerary) => {
                return (
                  <div
                    key={itinerary.id}
                    onClick={() => navigate(`/roteiros/${itinerary.id}`)}
                    className="group cursor-pointer flex flex-col justify-between flex-none w-[85vw] sm:w-[320px] snap-start rounded-[24px] border border-slate-200 bg-white p-6 transition-all hover:border-blue-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex flex-col gap-2">
                      {/* Top Bar: Badge */}
                      <div className="flex items-center">
                        {(itinerary.generation_status === "ready" ||
                          itinerary.generation_status === "generating") ? (
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            itinerary.generation_status === "generating" ? "bg-blue-50 text-blue-700 animate-pulse" : "bg-green-50 text-green-700"
                          }`}>
                            <Sparkles size={12} className={itinerary.generation_status === "generating" ? "text-blue-600" : "text-green-600"} />
                            <span>
                              {itinerary.generation_status === "generating"
                                ? "Gerando..."
                                : "Gerado por IA"}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            Rascunho
                          </div>
                        )}
                      </div>

                      {/* Meta Data Block */}
                      <div className="flex flex-col">
                        <h3 className="font-['Geist'] text-[18px] font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {itinerary.title}
                        </h3>
                        <p className="font-['Inter'] text-[14px] text-slate-500 line-clamp-2">
                          {itinerary.summary || "Roteiro personalizado em fase de planejamento."}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className="flex items-center gap-3 mt-6 text-[13px] font-medium text-slate-600 font-['Inter'] border-t border-slate-100 pt-4">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" /> {itinerary.duration_days} dias
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                      <span className="flex items-center gap-1.5 truncate">
                        <Wallet size={14} className="text-slate-400" />
                        {itinerary.budget_total
                          ? `R$ ${itinerary.budget_total}`
                          : "A definir"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
