import { CurrencyFlag } from "./currency-flag";
import { useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
const currencies = [{ value: "BRL", label: "Real Brasileiro", flag: "br" }, { value: "USD", label: "Dólar Americano", flag: "us" }, { value: "EUR", label: "Euro", flag: "eu" }];
export function PlanningCurrency({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><Button variant="outline" aria-label="Moeda da viagem">{value && <CurrencyFlag currency={value} />}<span className="planning-data">{value || "Moeda"}</span><ChevronDown size={16} /></Button></Popover.Trigger><Popover.Portal><Popover.Content className="currency-dropdown" sideOffset={8}><Input aria-label="Pesquisar moeda" placeholder="BRL ou Real Brasileiro" value={query} onChange={event => setQuery(event.target.value)} /><div className="space-y-2 mt-3">{currencies.filter(item => normalize(`${item.value} ${item.label}`).includes(normalize(query))).map(item => <button type="button" className="currency-option" key={item.value} onClick={() => { onChange(item.value); setOpen(false); setQuery(""); }}><CurrencyFlag currency={item.value} /><span>{item.value} · {item.label}</span>{value === item.value && <Check size={16} className="text-primary" />}</button>)}</div></Popover.Content></Popover.Portal></Popover.Root>;
}
