import { useState, type ComponentProps, type CSSProperties } from "react";
import { claimReveal } from "./reveal-state";

/** Stable identity prevents replay after filters, sorting and back navigation. */
export function Reveal({ revealKey, index = 0, className = "", style, ...props }: ComponentProps<"div"> & { revealKey: string; index?: number }) {
  const [enter] = useState(() => claimReveal(revealKey));
  return <div {...props} className={`${className} ${enter ? "motion-safe:animate-fade-up" : ""}`} style={{ ...style, "--entry-delay": `${Math.min(Math.max(index, 0), 6) * 50}ms` } as CSSProperties} />;
}
