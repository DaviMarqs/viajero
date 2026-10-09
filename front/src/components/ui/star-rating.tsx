import { Star } from "lucide-react";
import { useId } from "react";
import { cn, formatRating } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;
const STAR_LABELS = ["Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

export function StarRating({ value, size = "sm", className }: { value: number; size?: "sm" | "md"; className?: string; }) {
  const filled = Math.round(value);
  return <span role="img" aria-label={`Nota ${formatRating(value)} de 5`} className={cn("inline-flex items-center gap-0.5", className)}>
    {STARS.map(star => <Star key={star} aria-hidden="true" className={cn(size === "md" ? "size-5" : "size-4", star <= filled ? "fill-amber-500 text-amber-500" : "fill-transparent text-input")} />)}
  </span>;
}

/** Radios nativos (setas do teclado funcionam) com estrelas como rótulo. */
export function StarRatingInput({ name, legend, value, onChange, error, disabled = false }: {
  name: string;
  legend: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}) {
  const errorId = useId();
  return <fieldset className="space-y-2" disabled={disabled} aria-describedby={error ? errorId : undefined}>
    <legend className="text-sm font-medium text-strong">{legend}</legend>
    <div className="flex flex-wrap items-center gap-1">
      {STARS.map(star => {
        const id = `${name}-${star}`;
        return <label key={star} htmlFor={id} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-control transition-colors hover:bg-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <input id={id} type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} className="sr-only" aria-label={`${star} de 5: ${STAR_LABELS[star - 1]}`} />
          <Star aria-hidden="true" className={cn("size-7 transition-colors", star <= value ? "fill-amber-500 text-amber-500" : "fill-transparent text-input")} />
        </label>;
      })}
      <span className="ml-2 text-sm text-muted-foreground">{value ? STAR_LABELS[value - 1] : "Selecione uma nota"}</span>
    </div>
    {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}
