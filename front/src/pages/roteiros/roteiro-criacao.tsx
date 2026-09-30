import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapPin, Sparkles, Check } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { generateItinerary } from "@/features/itineraries/generation-service";
import { DestinationImage } from "@/features/destinations/destination-card";
import { destinationCardData } from "@/features/destinations/destination-adapter";
import { useDestinations } from "@/hooks/useDestinations";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Destination } from "@/types/travel";

function readDestinations(value: unknown): Destination[] {
  if (Array.isArray(value)) return value.flatMap(readDestinations);
  if (!value || typeof value !== "object") return [];
  if ("id" in value && "name" in value && typeof value.name === "string") return [value as Destination];
  if ("data" in value) return readDestinations(value.data);
  if ("results" in value) return readDestinations(value.results);
  if ("items" in value) return readDestinations(value.items);
  return [];
}
export default function RoteiroCriacaoPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const passed = location.state as { destination?: Destination; preferencesId?: number; } | null;
  const wantsSuggestion = new URLSearchParams(location.search).get("auto") === "destino";
  const [mode, setMode] = useState<"suggest" | "search" | null>(passed?.destination ? "search" : wantsSuggestion ? "suggest" : null);
  const [query, setQuery] = useState(passed?.destination?.name ?? "");
  const [results, setResults] = useState<Destination[] | null>(passed?.destination ? [passed.destination] : null);
  const [selected, setSelected] = useState<Destination | null>(passed?.destination ?? null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [createdId, setCreatedId] = useState<number | string | undefined>();
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const destinations = useDestinations();
  useEffect(() => () => controller.current?.abort(), []);
  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (locked.current) return;
    if (mode === "search" && !query.trim()) { setError("Digite o nome de uma cidade ou destino."); return; }
    locked.current = true; setBusy(true); setError(null); setSelected(null);
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    try {
      const response = mode === "suggest" ? await apiRequest("/api/destinations/suggest/", { method: "POST", signal: request.signal }) : await apiRequest("/api/destinations/search/", { signal: request.signal }, { q: query.trim() });
      setResults(readDestinations(response));
    } catch (err) { if (!request.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível buscar destinos."); }
    finally { locked.current = false; if (!request.signal.aborted) setBusy(false); }
  }
  async function generate() {
    if (!selected || locked.current || createdId) return;
    locked.current = true; setGenerating(true); setError(null);
    const request = new AbortController(); controller.current = request;
    try {
      const itinerary = await generateItinerary(selected, request.signal, next => { setProgress(next.message); if (next.itineraryId) setCreatedId(next.itineraryId); });
      navigate('/roteiros/' + itinerary.id);
    } catch (err) { if (!request.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível gerar o roteiro."); }
    finally { locked.current = false; if (!request.signal.aborted) setGenerating(false); }
  }
  const options = results ?? destinations.destinations.slice(0, 3);
  return <section className="page-content">
    <Breadcrumbs current="Criar roteiro" />
    <section className="surface space-y-8">
      <header className="mx-auto max-w-2xl space-y-4 py-4 text-center">
        <h1 className="page-title">{!mode ? "Como você quer começar sua próxima viagem?" : mode === "search" ? "Para onde você vai?" : "Vamos descobrir seu próximo destino"}
        </h1>
        <p className="text-muted-foreground">{!mode ? "Escolha como começar. Você poderá revisar o destino antes de gerar seu roteiro." : "Selecione um destino e confirme para montar seu roteiro."}
        </p>
      </header>
      {!mode ? <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">{[{ key: "suggest" as const, title: "Gostaria de uma sugestão", description: "A IA recomenda um destino com base no seu perfil de viagem.", icon: Sparkles }, { key: "search" as const, title: "Já sei para onde vou viajar", description: "Pesquise um destino para planejar sua próxima viagem.", icon: MapPin }].map(({ key, title, description, icon: Icon }) => <button key={key} onClick={() => setMode(key)} className="space-y-5 rounded-card border border-border p-8 text-left transition-colors hover:border-ring hover:bg-secondary/30">
        <span className="inline-flex rounded-card bg-secondary p-4 text-primary">
          <Icon aria-hidden="true" />
        </span>
        <h2 className="text-2xl">{title}
        </h2>
        <p className="text-strong">{description}
        </p>
      </button>)}
      </div> : <>
        {!generating && !createdId && <Button variant="ghost" onClick={() => { setMode(null); setError(null); }} disabled={busy}>← Alterar forma de começar</Button>}
        {!createdId && !generating && <form onSubmit={search} className="space-y-3">
          <label htmlFor="destination-search" className={mode === "suggest" ? "sr-only" : "block text-sm font-medium"}>Nome do destino</label>{mode === "search" && <Input id="destination-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: Lisboa, Porto, Salvador" aria-invalid={!!error && !query.trim()} aria-describedby={error ? "creation-error" : undefined} disabled={busy} />}
          <Button type="submit" disabled={busy}>{busy ? "Buscando destinos…" : mode === "suggest" ? "Sugerir um destino" : "Buscar destino"}
          </Button>
        </form>}
        {busy && <Feedback kind="loading" title="Buscando seu próximo destino…" description="A descoberta pode levar alguns segundos." />}
        {error && <div id="creation-error">
          <Feedback kind="error" title="Não foi possível concluir" description={error}>{createdId && <Button asChild>
            <Link to={'/roteiros/' + createdId}>Abrir roteiro criado</Link>
          </Button>}
          </Feedback>
        </div>}
        {generating && <Feedback kind="loading" title="Montando seu roteiro" description={progress} />}
        {!generating && !createdId && !busy && <div className="space-y-4">{results === null && <h2 className="section-title">Destinos disponíveis</h2>}{results === null && destinations.error ? <Feedback kind="error" title="Destinos indisponíveis" description={destinations.error} onRetry={destinations.refetch} /> : results === null && destinations.loading ? <Feedback kind="loading" title="Carregando destinos…" /> : options.length === 0 ? <Feedback title="Nenhum destino encontrado" description="Pesquise outro nome ou peça uma sugestão." /> : options.map(destination => {
          const card = destinationCardData(destination); const active = selected?.id === destination.id; return <button key={destination.id} type="button" aria-pressed={active} onClick={() => setSelected(destination)} className={'flex w-full flex-col gap-6 rounded-card border p-4 text-left transition-colors sm:flex-row sm:items-center ' + (active ? 'border-ring bg-secondary/20' : 'border-border hover:bg-muted')}>
            <DestinationImage src={card.image} name={destination.name} className="h-40 w-full shrink-0 rounded-card sm:w-56" />
            <div className="min-w-0 flex-1 space-y-3">
              <h3 className="text-xl">{destination.name}
              </h3>
              <p className="text-sm text-strong">{destination.country}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{destination.summary}
              </p>
            </div>
            <span className="badge">{active && <Check className="size-4" aria-hidden="true" />}{active ? "Selecionado" : "Selecionar"}
            </span>
          </button>;
        })}
        </div>}
        {selected && !createdId && !generating && !busy && <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-background p-4">
          <div>
            <p className="text-sm text-muted-foreground">Destino selecionado</p>
            <p className="font-display text-xl font-semibold">{selected.name}
            </p>
          </div>
          <Button onClick={generate}>Gerar roteiro para este destino</Button>
        </div>}
        {createdId && <p className="text-sm text-muted-foreground">Sair desta tela interrompe apenas o acompanhamento. <Link className="text-primary underline" to="/roteiros">Ver meus roteiros</Link>
        </p>}
      </>}
    </section>
  </section>;
}
