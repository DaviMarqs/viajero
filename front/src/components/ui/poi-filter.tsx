
type PoiType = "all" | "attraction" | "restaurant" | "activity" | "lodging";

const filterOptions: { value: PoiType; label: string }[] = [
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
    <div className="flex gap-1 text-sm bg-neutral-100 rounded-2xl p-1.5 w-fit">
      {filterOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-xl text-sm transition-colors whitespace-nowrap ${
            activeFilter === opt.value
              ? "bg-white font-semibold text-neutral-900 border border-neutral-200"
              : "text-neutral-500 hover:text-neutral-700 hover:bg-white/60"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}