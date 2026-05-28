import type { ChangeEvent } from "react";
import { DollarSign, Info} from "lucide-react";

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
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = parseBRL(e.target.value);
    onChange(raw);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-sky-500 focus-within:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]">
        <span className="text-slate-400">
          <DollarSign size={18} />
        </span>
        <input
          type="text"
          inputMode="numeric"
          className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          placeholder="R$ 0,00"
          value={value ? formatBRL(value) : ""}
          onChange={handleChange}
        />
      </div>

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-500">
          <span className="text-slate-400"><Info className="size-5" /></span> {hint}
        </p>
      )}
    </div>
  );
}
