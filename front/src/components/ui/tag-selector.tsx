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
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={
              selected.includes(opt.value)
                ? "rounded-full border border-sky-500 bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:border-sky-600 hover:bg-sky-600"
                : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            }
            onClick={() => toggle(opt.value)}
            aria-pressed={selected.includes(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-500">
          <span className="text-slate-400"><Info className="size-5" /></span> {hint}
        </p>
      )}
    </div>
  );
}
