import { useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { useMoney } from "@/contexts/currencyContext";
import { useAuth } from "@/contexts/authContext";
import { apiRequest, type ApiSuccessResponse } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { Button } from "./button";
import { CurrencyFlag } from "./currency-flag";

const currencies = [
  ["BRL", "Real brasileiro"], ["USD", "Dólar americano"],
  ["EUR", "Euro"], ["GBP", "Libra esterlina"],
  ["ARS", "Peso argentino"], ["JPY", "Iene japonês"],
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function CurrencyPicker() {
  const { currency, status, date } = useMoney();
  const { updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const results = currencies.filter(([code, name]) => normalize(`${code} ${name}`).includes(normalize(query)));
  async function select(code: string) {
    if (saving) return;
    if (code === currency) { setOpen(false); return; }
    setSaving(code);
    setError("");
    try {
      const response = await apiRequest<ApiSuccessResponse<AuthUser>>("/api/users/me/", {
        method: "PATCH", body: JSON.stringify({ preferred_currency: code }),
      });
      if (!response.data) throw new Error("Não foi possível confirmar a moeda salva.");
      updateUser(response.data);
      setAnnouncement(`Moeda de exibição atualizada para ${code}.`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally { setSaving(null); }
  }
  return <>
    <Popover.Root open={open} onOpenChange={(value) => { if (!saving) { setOpen(value); setQuery(""); setError(""); } }}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label={`Moeda de exibição: ${currency}. Alterar moeda`}>
          <CurrencyFlag currency={currency} />{currency}<ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="currency-dropdown" aria-label="Escolher moeda de exibição" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onInteractOutside={(event) => { if (saving) event.preventDefault(); }}>
          <label className="form-control-shell mb-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input autoFocus aria-label="Pesquisar moeda por código ou nome" placeholder="Código ou nome da moeda" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent outline-none" />
          </label>
          <div className="max-h-64 overflow-y-auto" aria-busy={!!saving}>
            {results.map(([code, name]) => <button key={code} type="button" disabled={!!saving} onClick={() => void select(code)} aria-pressed={currency === code} className="currency-option">
              <CurrencyFlag currency={code} /><span className="w-10 shrink-0 font-medium">{code}</span><span className="flex-1 text-left">{name}</span>
              {saving === code ? <LoaderCircle className="size-4 animate-spin" aria-label="Salvando" /> : currency === code ? <Check className="size-4 text-primary" aria-label="Selecionada" /> : null}
            </button>)}
            {!results.length && <p className="p-3 text-sm text-muted-foreground" role="status">Nenhuma moeda encontrada.</p>}
          </div>
          <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{status === "ready" ? `Conversão aproximada · ${date}. Valores sem cotação permanecem na moeda original.` : status === "loading" ? "Consultando câmbio; valores na moeda original." : "Câmbio indisponível; valores na moeda original."}</p>
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    <span className="sr-only" role="status">{announcement}</span>
  </>;
}
