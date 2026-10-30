import br from "flag-icons/flags/4x3/br.svg";
import us from "flag-icons/flags/4x3/us.svg";
import eu from "flag-icons/flags/4x3/eu.svg";
import gb from "flag-icons/flags/4x3/gb.svg";
import ar from "flag-icons/flags/4x3/ar.svg";
import jp from "flag-icons/flags/4x3/jp.svg";

const flags: Record<string, string> = { BRL: br, USD: us, EUR: eu, GBP: gb, ARS: ar, JPY: jp };
export function CurrencyFlag({ currency }: { currency: string }) {
  return flags[currency] ? <img src={flags[currency]} alt="" aria-hidden="true" className="h-4 w-5 shrink-0 rounded-sm object-cover" /> : null;
}
