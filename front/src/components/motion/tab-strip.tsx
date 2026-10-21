import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "./use-reduced-motion";

export function TabStrip({ label, children, selected }: { label: string; children: ReactNode; selected: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const strip = ref.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !tab) return;
    const sync = () => {
      strip.style.setProperty("--tab-x", `${tab.offsetLeft}px`);
      strip.style.setProperty("--tab-width", `${tab.offsetWidth}px`);
    };
    sync();
    // Scroll the strip only: selecting a day must not move the whole page.
    strip.scrollTo({ left: Math.max(0, tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2), behavior: reduced ? "instant" : "smooth" });
    const observer = new ResizeObserver(sync);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [selected, reduced]);
  return <div ref={ref} className="day-tabs motion-tab-strip" role="tablist" aria-label={label}>{children}<span className="motion-tab-indicator" aria-hidden="true" /></div>;
}
