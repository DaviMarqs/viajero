import { Collapse } from "@/components/motion/collapse";
import { useId, useLayoutEffect, useRef } from "react";
import type { ChangeEvent } from "react";


interface InputCurrencyProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  error?: string;
}

function formatBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  error,
}: InputCurrencyProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const digitsRight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element || digitsRight.current == null || document.activeElement !== element) return;
    let position = element.value.length;
    let remaining = digitsRight.current;
    while (position > 0 && remaining > 0) { position--; if (/\d/.test(element.value[position])) remaining--; }
    element.setSelectionRange(position, position);
    digitsRight.current = null;
  }, [value]);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    digitsRight.current = parseBRL(e.target.value.slice(e.target.selectionStart ?? e.target.value.length)).length;
    const raw = parseBRL(e.target.value);
    onChange(raw);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-strong">
        {label}
        {!required && <span className="text-ink-muted"> (opcional)</span>}
      </label>

      <div className="form-control-shell">
        <span className="money-prefix" aria-hidden="true">{new Intl.NumberFormat("pt-BR", { style: "currency", currency }).formatToParts(0).find(part => part.type === "currency")?.value}</span>
        <input ref={input} id={id} required={required} aria-invalid={!!error} aria-describedby={[hint ? id + "-hint" : "", error ? id + "-error" : ""].filter(Boolean).join(" ") || undefined}
          type="text"
          inputMode="numeric"
          className="h-full w-full min-w-0 border-0 bg-transparent font-data text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder={formatBRL("0")}
          value={value ? formatBRL(value) : ""}
          onChange={handleChange}
        />
      </div>

      <Collapse open={!!error}>{error && <p id={id + "-error"} role="alert" className="field-support">{error}</p>}</Collapse>

      {hint && (
        <p id={id + "-hint"} className="field-support">{hint}</p>
      )}
    </div>
  );
}
