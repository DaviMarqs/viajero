import { FilterChip } from "./filter-chip";
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
    <div className="flex flex-wrap gap-2" aria-label="Tipos de experiência">
      {filterOptions.map((opt) => (
        <FilterChip
          key={opt.value}
          type="button"
          selected={activeFilter === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </FilterChip>
      ))}
    </div>
  );
}
