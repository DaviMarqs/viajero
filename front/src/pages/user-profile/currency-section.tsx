import { useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { useMoney } from "@/contexts/currencyContext";
import { apiRequest, type ApiSuccessResponse } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const DISPLAY_CURRENCIES = [
  ["BRL", "Real brasileiro"],
  ["USD", "Dólar americano"],
  ["EUR", "Euro"],
  ["GBP", "Libra esterlina"],
  ["ARS", "Peso argentino"],
  ["JPY", "Iene japonês"],
];
export function CurrencySection() {
  const { updateUser } = useAuth();
  const { currency, status, date } = useMoney();
  const [selected, setSelected] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiRequest<ApiSuccessResponse<AuthUser>>(
        "/api/users/me/",
        {
          method: "PATCH",
          body: JSON.stringify({ preferred_currency: selected }),
        },
      );
      if (!response.data)
        throw new Error("Não foi possível confirmar a moeda salva.");
      updateUser(response.data);
      setMessage("Moeda de exibição atualizada.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar a moeda.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      id="moeda"
      className="scroll-mt-24 space-y-5 border-t border-border pt-6"
    >
      <div className="space-y-2">
        <h2 className="section-title">Moeda de exibição</h2>
        <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
          Escolha a moeda para comparar destinos e roteiros. Isso não altera o
          orçamento original da viagem.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="form-label">
          Sua moeda
          <select
            className="h-11 rounded-control border border-input bg-surface px-3"
            value={selected}
            disabled={saving}
            onChange={(e) => {
              setSelected(e.target.value);
              setMessage("");
            }}
          >
            {DISPLAY_CURRENCIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label} ({code})
              </option>
            ))}
          </select>
        </label>
        <Button onClick={save} disabled={saving || selected === currency}>
          {saving ? "Salvando…" : "Salvar moeda"}
        </Button>
      </div>
      <p className="max-w-[70ch] text-xs leading-5 text-muted-foreground">
        {status === "ready"
          ? `Conversões aproximadas, com cotação de ${date}. Taxas e impostos não estão incluídos. Valores sem cotação disponível permanecem na moeda original.`
          : status === "loading"
            ? "Consultando o câmbio. Por enquanto, valores na moeda original."
            : "O câmbio está indisponível. Os valores são exibidos na moeda original."}
      </p>
      <p role="status" className="text-sm text-success">
        {message}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
