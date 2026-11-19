import { Compass, Info, Lightbulb, MapPin, Umbrella } from "lucide-react";
import type { ReactNode } from "react";
import { useMoney } from "@/contexts/currencyContext";
import type { DayDetails, TripGuide } from "@/types/travel";

const BENCHMARK_LABELS: Record<string, string> = {
  meal_budget: "Refeição econômica",
  meal_mid: "Refeição média",
  meal_high: "Refeição sofisticada",
  public_transport_ride: "Passagem de transporte público",
  taxi_short: "Táxi/app curto",
  hotel_night: "Diária de hotel",
  attraction_ticket: "Ingresso típico",
};

function GuideItem({ title, children }: { title: string; children: ReactNode }) {
  return <div className="space-y-1"><dt className="text-sm font-medium">{title}</dt><dd className="text-sm leading-6 text-muted-foreground">{children}</dd></div>;
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

const list = (items?: string[]) => items?.length ? <ul className="list-disc space-y-1 pl-5">{items.map(item => <li key={item}>{item}</li>)}</ul> : null;

export function TripGuideCard({ guide, currency }: { guide: TripGuide; currency: string }) {
  const { money } = useMoney();
  const benchmarks = Object.entries(guide.cost_benchmarks ?? {}).filter(([key, value]) => BENCHMARK_LABELS[key] && Number(value) > 0);
  return <section className="budget-panel space-y-5" aria-labelledby="trip-guide-title">
    <h2 id="trip-guide-title" className="flex items-center gap-2 text-xl"><Compass className="size-5" aria-hidden="true" />Guia da viagem</h2>
    {guide.overview && <p className="text-sm leading-6 text-muted-foreground">{guide.overview}</p>}
    <dl className="space-y-4">
      {guide.weather && <GuideItem title="Clima">{guide.weather}</GuideItem>}
      {guide.getting_around && <GuideItem title="Como se locomover">{guide.getting_around}</GuideItem>}
      {!!guide.neighborhoods?.length && <GuideItem title="Bairros">
        <ul className="space-y-1">{guide.neighborhoods.map(item => <li key={item.name}><span className="text-foreground">{item.name}</span>{item.description ? ` — ${item.description}` : ""}</li>)}</ul>
      </GuideItem>}
      {guide.money && <GuideItem title="Dinheiro e gorjeta">{guide.money}</GuideItem>}
      {guide.safety && <GuideItem title="Segurança">{guide.safety}</GuideItem>}
      {guide.etiquette && <GuideItem title="Etiqueta">{guide.etiquette}</GuideItem>}
      {!!guide.packing?.length && <GuideItem title="O que levar">{list(guide.packing)}</GuideItem>}
      {!!guide.phrases?.length && <GuideItem title="Frases úteis">{list(guide.phrases)}</GuideItem>}
      {!!guide.local_events?.length && <GuideItem title="Eventos no período">{list(guide.local_events)}</GuideItem>}
      {guide.documents_health && <GuideItem title="Documentos e saúde">{guide.documents_health}</GuideItem>}
      {benchmarks.length > 0 && <GuideItem title="Custos de referência">
        <ul className="space-y-1">{benchmarks.map(([key, value]) => <li key={key} className="flex justify-between gap-3"><span>{BENCHMARK_LABELS[key]}</span><span className="font-mono tabular-nums">{money(value, currency)}</span></li>)}</ul>
        <p className="mt-2 text-xs">{guide.cost_benchmarks_source
          ? <>Fonte: <a className="underline" href={guide.cost_benchmarks_source} target="_blank" rel="noreferrer noopener">{hostname(guide.cost_benchmarks_source)}</a>, resumida pela IA.</>
          : "Média estimada pela IA (sem fonte externa)."}</p>
      </GuideItem>}
    </dl>
    {!!guide.sources?.length && <p className="text-xs text-muted-foreground">Fontes: {guide.sources.map((source, index) => <span key={source}>{index > 0 && ", "}<a className="underline" href={source} target="_blank" rel="noreferrer noopener">{hostname(source)}</a></span>)}</p>}
  </section>;
}

/** Área, plano B (chuva), alternativas e dicas do dia. */
export function DayExtras({ details, currency }: { details?: DayDetails | null; currency: string }) {
  const { money } = useMoney();
  if (!details) return null;
  const { area, rain_plan, alternatives, tips } = details;
  if (!area && !rain_plan && !alternatives?.length && !tips?.length) return null;
  return <div className="day-extras space-y-4">
    {area && <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4 shrink-0" aria-hidden="true" />Região do dia: <span className="text-foreground">{area}</span></p>}
    {rain_plan && <div className="space-y-1"><h3 className="flex items-center gap-2 text-sm font-medium"><Umbrella className="size-4" aria-hidden="true" />Plano B (chuva)</h3><p className="text-sm leading-6 text-muted-foreground">{rain_plan}</p></div>}
    {!!alternatives?.length && <div className="space-y-1"><h3 className="flex items-center gap-2 text-sm font-medium"><Info className="size-4" aria-hidden="true" />Alternativas</h3>
      <ul className="space-y-1 text-sm text-muted-foreground">{alternatives.map(item => <li key={item.title}><span className="text-foreground">{item.title}</span>{item.description ? ` — ${item.description}` : ""}{Number(item.estimated_cost) > 0 ? ` (${money(item.estimated_cost as string, currency)})` : ""}</li>)}</ul>
    </div>}
    {!!tips?.length && <div className="space-y-1"><h3 className="flex items-center gap-2 text-sm font-medium"><Lightbulb className="size-4" aria-hidden="true" />Dicas do dia</h3><div className="text-sm text-muted-foreground">{list(tips)}</div></div>}
  </div>;
}
