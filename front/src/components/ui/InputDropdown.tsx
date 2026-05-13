import { Calendar, ChevronDown } from "lucide-react";

interface InputDropdownProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
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
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-sky-500 focus-within:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]">
        {icon === "calendar" && (
          <span className="text-slate-400">
            <Calendar size={18} />
          </span>
        )}
        <select
          className="h-full w-full appearance-none border-0 bg-transparent text-sm text-slate-900 outline-none"
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
        <span className="pointer-events-none text-slate-400">
          <ChevronDown size={18} />
        </span>
      </div>

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-500">
          <span className="text-slate-400">i</span> {hint}
        </p>
      )}
    </div>
  );
}
