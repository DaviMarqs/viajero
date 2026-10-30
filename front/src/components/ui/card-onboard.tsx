import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CardOnboardProps {
  cardTitle: string;
  cardDescription: string;
  icon: LucideIcon;
  selected?: boolean;
  onClick?: () => void;
  radio?: boolean;
  tabIndex?: number;
}

export default function CardOnboard({
  cardTitle,
  cardDescription,
  icon: Icon,
  selected = false,
  onClick,
  radio = false,
  tabIndex,
}: CardOnboardProps) {
  return (
    <button
      type="button"
      data-onboard-card
      data-selected={selected}
      className={cn(
        "onboard-option",
        selected
          ? "border-ring bg-secondary"
          : "border-border bg-white hover:border-input hover:bg-muted",
      )}
      onClick={onClick}
      role={radio ? "radio" : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      tabIndex={tabIndex}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-control transition-colors",
          "text-strong",
        )}
      >
        <Icon size={22} aria-hidden />
      </div>

      <div className="onboard-option-copy">
        <h3 className="mb-1 text-base font-medium text-foreground">{cardTitle}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{cardDescription}
        </p>
      </div>

      <div
        className={cn(
          "option-check flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-ring bg-primary text-white"
            : "border-input bg-white",
        )}
        aria-hidden
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </div>
    </button>
  );
}
