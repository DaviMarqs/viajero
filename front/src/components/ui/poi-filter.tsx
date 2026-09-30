
type PoiType = "all" | "attraction" | "restaurant" | "activity" | "lodging";

const filterOptions: { value: PoiType; label: string; }[] = [
  { value: "all", label: "Todos" },
  { value: "attraction", label: "Ponto turístico" },
  { value: "restaurant", label: "Restaurante" },
  { value: "activity", label: "Atividade" },
  { value: "lodging", label: "Hospedagem" },
];

interface PoiFilterProps {
  activeFilter: PoiType;
  onChange: (type: PoiType) => void;
}

export default function PoiFilter({ activeFilter, onChange }: PoiFilterProps) {
  return (
    <div className="flex flex-wrap gap-1 text-sm bg-background rounded-2xl p-1.5 w-full">
      {filterOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={activeFilter === opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-11 px-4 py-1.5 rounded-xl text-sm transition-colors whitespace-nowrap ${activeFilter === opt.value
            ? "bg-white font-semibold text-foreground border border-border"
            : "text-muted-foreground hover:text-strong hover:bg-white/60"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
