import { useId } from "react";
import type { ChangeEvent } from "react";
import { DollarSign, Info } from "lucide-react";

interface InputCurrencyProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  currency?: string;
}

function formatBRL(raw: string, currency: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString("pt-BR", { style: "currency", currency });
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
  currency = "BRL",
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

      <div className="form-control-shell">
        <span className="text-muted-foreground">
          <DollarSign size={18} />
        </span>
        <input id={id} required={required} aria-describedby={hint ? id + "-hint" : undefined}
          type="text"
          inputMode="numeric"
          className="h-full w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder={formatBRL("0", currency)}
          value={value ? formatBRL(value, currency) : ""}
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
