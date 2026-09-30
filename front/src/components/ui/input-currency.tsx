import { useId } from "react";
import type { ChangeEvent } from "react";
import { DollarSign, Info } from "lucide-react";

interface InputCurrencyProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}

function formatBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

export default function InputCurrency({
  label,
  hint,
  required,
  value,
  onChange,
}: InputCurrencyProps) {
  const id = useId();
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = parseBRL(e.target.value);
    onChange(raw);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-strong">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-white px-4 transition focus-within:border-ring focus-within:shadow-card">
        <span className="text-muted-foreground">
          <DollarSign size={18} />
        </span>
        <input id={id} required={required} aria-describedby={hint ? id + "-hint" : undefined}
          type="text"
          inputMode="numeric"
          className="h-full w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="R$ 0,00"
          value={value ? formatBRL(value) : ""}
          onChange={handleChange}
        />
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
