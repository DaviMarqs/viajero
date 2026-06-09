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
        "group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200",
        selected
          ? "border-blue-500 bg-blue-50/50 shadow-[0_4px_20px_rgba(37,99,235,0.08)] ring-1 ring-blue-500"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
      )}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
          selected ? "bg-blue-100 text-blue-600" : "bg-neutral-100 text-neutral-500 group-hover:bg-white",
        )}
      >
        <Icon size={24} aria-hidden strokeWidth={selected ? 2.5 : 2} />
      </div>

      <div className="flex-1">
        <h3 className="mb-1 font-['Geist'] text-lg font-medium text-neutral-900">{cardTitle}</h3>
        <p className="text-sm leading-relaxed text-neutral-500">{cardDescription}</p>
      </div>

      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
          selected
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-neutral-300 bg-transparent text-transparent",
        )}
        aria-hidden
      >
        {selected && <Check size={14} strokeWidth={3} />}
      </div>
    </button>
  );
}
