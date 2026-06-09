import {Info} from "lucide-react";

interface InputTextareaProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export default function InputTextarea({
  label,
  hint,
  required,
  value,
  onChange,
  placeholder = "",
  rows = 3,
}: InputTextareaProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <textarea
        className="min-h-32 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm leading-relaxed text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 hover:border-neutral-300 hover:bg-white resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-neutral-500">
          <span className="text-neutral-400 mt-0.5"><Info className="size-4" /></span> {hint}
        </p>
      )}
    </div>
  );
}
