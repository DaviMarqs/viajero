import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function SlidingNav({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const sync = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      nav.style.setProperty("--nav-y", `${active ? active.getBoundingClientRect().top - nav.getBoundingClientRect().top : 0}px`);
      nav.style.setProperty("--nav-height", `${active?.offsetHeight ?? 0}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname]);
  return <nav ref={ref} aria-label={label} className="motion-sliding-nav"><span className="motion-nav-indicator" aria-hidden="true" />{children}</nav>;
}
