import {Info} from "lucide-react";

interface TagOption {
  label: string;
  value: string;
}

interface TagSelectorProps {
  label: string;
  hint?: string;
  required?: boolean;
  options: TagOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multi?: boolean;
}

export default function TagSelector({
  label,
  hint,
  required,
  options,
  selected,
  onChange,
  multi = true,
}: TagSelectorProps) {
  const toggle = (value: string) => {
    if (multi) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange(selected.includes(value) ? [] : [value]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={
              selected.includes(opt.value)
                ? "rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all shadow-sm"
                : "rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50"
            }
            onClick={() => toggle(opt.value)}
            aria-pressed={selected.includes(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-neutral-500">
          <span className="text-neutral-400 mt-0.5"><Info className="size-4" /></span> {hint}
        </p>
      )}
    </div>
  );
}
