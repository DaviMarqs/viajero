import { useId } from "react";
import { Calendar, ChevronDown, Info } from "lucide-react";

interface InputDropdownProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string; }[];
  icon?: "calendar" | "none";
  placeholder?: string;
}

export default function InputDropdown({
  label,
  hint,
  required,
  value,
  onChange,
  options,
  icon = "none",
  placeholder = "Selecione",
}: InputDropdownProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-strong">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="form-control-shell">
        {icon === "calendar" && (
          <span className="text-muted-foreground">
            <Calendar size={18} />
          </span>
        )}
        <select id={id} required={required} aria-describedby={hint ? id + "-hint" : undefined}
          className="h-full w-full appearance-none border-0 bg-transparent text-sm text-foreground outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none text-muted-foreground">
          <ChevronDown size={18} />
        </span>
      </div>

      {hint && (
        <p id={id + "-hint"} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <span className="text-muted-foreground">
            <Info className="size-5" />
          </span> {hint}
        </p>
      )}
    </div>
  );
}
