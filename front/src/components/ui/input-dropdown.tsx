import { Calendar, ChevronDown, Info } from "lucide-react";

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
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="relative flex h-14 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 transition-all focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 hover:border-neutral-300 hover:bg-white">
        {icon === "calendar" && (
          <span className="text-neutral-400">
            <Calendar size={18} />
          </span>
        )}
        <select
          className="peer h-full w-full appearance-none border-0 bg-transparent text-sm text-neutral-900 outline-none cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled className="text-neutral-400">
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-neutral-900">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 text-neutral-400 transition-colors peer-focus:text-blue-500">
          <ChevronDown size={18} />
        </span>
      </div>

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-neutral-500">
          <span className="text-neutral-400 mt-0.5"><Info className="size-4" /></span> {hint}
        </p>
      )}
    </div>
  );
}
