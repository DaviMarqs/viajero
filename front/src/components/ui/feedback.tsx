import { AlertCircle, Compass, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Feedback({ title, description, kind = "empty", onRetry, children }: {
  title: string; description?: string; kind?: "empty" | "error" | "loading";
  onRetry?: () => void; children?: ReactNode;
}) {
  const Icon = kind === "error" ? AlertCircle : kind === "loading" ? Loader2 : Compass;
  return <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-card border border-border bg-surface p-6 text-center" role={kind === "error" ? "alert" : "status"} aria-busy={kind === "loading"}>
    <Icon aria-hidden="true" className={`size-6 ${kind === "error" ? "text-destructive" : "text-primary"} ${kind === "loading" ? "animate-spin" : ""}`} />
    <div className="space-y-2">
      <p className="font-medium">{title}
      </p>{description && <p className="max-w-lg text-sm text-muted-foreground">{description}
      </p>}
    </div>
    {onRetry && <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}{children}
  </div>;
}

export function CardSkeletons() {
  return <div role="status" aria-label="Carregando destinos" className="grid gap-4 sm:grid-cols-2">
    {[0, 1].map(id => <div key={id} aria-hidden="true" className="overflow-hidden rounded-card border border-border motion-safe:animate-pulse">
      <div className="h-56 bg-muted" />
      <div className="space-y-4 p-6">
        <div className="h-5 w-2/3 rounded bg-muted" />
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
    </div>)}
  </div>;
}
