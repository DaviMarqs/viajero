/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/authContext";
import { formatCurrency } from "@/lib/utils";
import { convertAmount, type ExchangeRate } from "@/lib/currency";

type Rate = ExchangeRate;
const CurrencyContext = createContext({
  currency: "BRL",
  rates: [] as Rate[],
  status: "loading",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const currency = user?.preferred_currency || "BRL";
  const [rates, setRates] = useState<Rate[]>([]);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch("https://api.frankfurter.dev/v2/rates?base=EUR", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then((response) => {
        if (!response.ok) throw new Error("rates");
        return response.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error("rates");
        const valid = data.filter(
          (item): item is Rate =>
            typeof item?.quote === "string" &&
            typeof item?.date === "string" &&
            Number.isFinite(item?.rate) &&
            item.rate > 0,
        );
        if (!valid.length) throw new Error("rates");
        setRates([
          { date: valid[0].date, base: "EUR", quote: "EUR", rate: 1 },
          ...valid,
        ]);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unavailable");
      });
    return () => controller.abort();
  }, []);
  return (
    <CurrencyContext.Provider value={{ currency, rates, status }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useMoney() {
  const { currency, rates, status } = useContext(CurrencyContext);
  function convertedAmount(value: unknown, source = "BRL") {
    return convertAmount(value, source, currency, rates);
  }
  function money(value: string | number | null | undefined, source = "BRL") {
    const converted = convertedAmount(value, source);
    return converted == null
      ? formatCurrency(value, "pt-BR", source)
      : formatCurrency(converted, "pt-BR", currency);
  }
  return { money, convertedAmount, currency, status, date: rates[0]?.date };
}
