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
        "flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left transition",
        selected
          ? "border-sky-500 bg-sky-50 shadow-[0_12px_30px_rgba(46,140,255,0.12)]"
          : "border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50",
      )}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition",
          selected ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600",
        )}
      >
        <Icon size={22} aria-hidden />
      </div>

      <div className="flex-1">
        <h3 className="mb-1 text-base font-semibold text-slate-950">{cardTitle}</h3>
        <p className="text-sm leading-6 text-slate-500">{cardDescription}</p>
      </div>

      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
          selected
            ? "border-sky-500 bg-sky-500 text-white"
            : "border-slate-300 bg-white text-transparent",
        )}
        aria-hidden
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </div>
    </button>
  );
}
