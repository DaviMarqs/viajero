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
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="relative flex h-14 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 transition-all focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 hover:border-neutral-300 hover:bg-white">
        <span className="text-neutral-400">
          <DollarSign size={18} />
        </span>
        <input
          type="text"
          inputMode="numeric"
          className="peer h-full w-full border-0 bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400 placeholder:font-normal"
          placeholder="R$ 0,00"
          value={value ? formatBRL(value) : ""}
          onChange={handleChange}
        />
      </div>

      {hint && (
        <p className="flex items-start gap-2 text-sm leading-6 text-neutral-500">
          <span className="text-neutral-400 mt-0.5"><Info className="size-4" /></span> {hint}
        </p>
      )}
    </div>
  );
}
