import { AlertCircle, Compass, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Feedback({ title, description, kind = "empty", onRetry, children, className = "" }: {
  title: string; description?: string; kind?: "empty" | "error" | "loading";
  onRetry?: () => void; children?: ReactNode; className?: string;
}) {
  const Icon = kind === "error" ? AlertCircle : kind === "loading" ? Loader2 : Compass;
  return <div className={`feedback ${className}`} role={kind === "error" ? "alert" : "status"} aria-busy={kind === "loading"}>
    <Icon aria-hidden="true" className={`feedback-icon ${kind === "loading" ? "animate-spin" : ""}`} />
    <div className="space-y-2">
      <p className="font-medium">{title}
      </p>{description && <p className="max-w-lg text-sm text-muted-foreground">{description}
      </p>}
    </div>
    {onRetry && <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}{children}
  </div>;
}

export function CardSkeletons({ label = "Carregando destinos", layout = "grid" }: { label?: string; layout?: "grid" | "collection" | "home" }) {
  if (layout === "home") return <div role="status" aria-busy="true" className="home-skeleton-grid"><span className="sr-only">{label}</span>{[0, 1, 2, 3].map(id => <div key={id} aria-hidden="true" className="travel-card skeleton-card"><div className="home-trip-image skeleton-block" /><div className="home-trip-body"><div className="h-6 w-3/4 skeleton-block" /><div className="h-4 w-2/3 skeleton-block" /><div className="h-3 w-1/3 skeleton-block" /><div className="home-trip-details"><div className="h-4 w-2/3 skeleton-block" /></div><div className="home-trip-cost"><div className="h-11 w-2/3 skeleton-block" /></div></div></div>)}</div>;
  return <div role="status" aria-busy="true" className={layout === "collection" ? "collection-scroll" : "travel-grid"}>
    <span className="sr-only">{label}</span>
    {(layout === "collection" ? [0] : [0, 1, 2]).map(id => <div key={id} aria-hidden="true" className="travel-card skeleton-card">
      <div className="travel-card-media skeleton-block" />
      <div className="travel-card-body">
        <div className="h-4 w-1/3 skeleton-block" />
        <div className="h-12 w-3/4 skeleton-block" />
        <div className="h-12 skeleton-block" />
        <div className="h-6 w-2/3 skeleton-block" />
        <div className="travel-card-footer"><div className="h-11 w-1/3 skeleton-block" /><div className="h-11 w-1/3 skeleton-block" /></div>
      </div>
    </div>)}
  </div>;
}

export function PageSkeleton() {
  return <div className="page-content" role="status" aria-busy="true">
    <span className="sr-only">Carregando página…</span>
    <div aria-hidden="true" className="h-8 w-1/3 skeleton-block" />
    <div aria-hidden="true" className="h-52 skeleton-block" />
    <CardSkeletons />
  </div>;
}
