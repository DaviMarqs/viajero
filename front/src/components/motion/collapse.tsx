import type { ReactNode } from "react";

export function Collapse({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  return <div className={`motion-collapse ${className}`} data-open={open} inert={!open} aria-hidden={!open}><div>{children}</div></div>;
}
