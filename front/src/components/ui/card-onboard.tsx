import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CardOnboardProps {
  cardTitle: string;
  cardDescription: string;
  icon: LucideIcon;
  selected?: boolean;
  onClick?: () => void;
}

export default function CardOnboard({
  cardTitle,
  cardDescription,
  icon: Icon,
  selected = false,
  onClick,
}: CardOnboardProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-4 rounded-card border px-5 py-4 text-left transition-colors",
        selected
          ? "border-ring bg-secondary"
          : "border-border bg-white hover:border-input hover:bg-muted",
      )}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-control transition-colors",
          selected ? "bg-secondary text-primary" : "bg-background text-strong",
        )}
      >
        <Icon size={22} aria-hidden />
      </div>

      <div className="flex-1">
        <h3 className="mb-1 text-base font-semibold text-foreground">{cardTitle}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{cardDescription}
        </p>
      </div>

      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
          selected
            ? "border-ring bg-primary text-white"
            : "border-border bg-white text-transparent",
        )}
        aria-hidden
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </div>
    </button>
  );
}
