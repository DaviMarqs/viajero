import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FilterChip({ selected = false, count, children, className, ...props }: ComponentProps<"button"> & { selected?: boolean; count?: number }) {
  return <button {...props} type="button" aria-pressed={selected} className={cn("filter-chip", className)}>
    {children}{count != null && <span className="font-mono text-xs">{count}</span>}
  </button>;
}
