import { useId } from "react";
import { Info } from "lucide-react";

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
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-strong">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <textarea id={id} required={required} aria-describedby={hint ? id + "-hint" : undefined}
        className="min-h-32 w-full rounded-control border border-input bg-white px-4 py-4 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />

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
