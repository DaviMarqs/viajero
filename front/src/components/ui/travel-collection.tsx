import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "./button";

export function TravelCollection({ children, label, single = false, home = false, completeCards = false }: { children: ReactNode; label: string; single?: boolean; home?: boolean; completeCards?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [columns, setColumns] = useState(1);
  const [positions, setPositions] = useState<number[]>([0]);
  const [active, setActive] = useState(0);
  const items = Children.toArray(children);
  const [atEnd, setAtEnd] = useState(items.length < (single ? 2 : 3));
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const sync = () => {
      const maximum = Math.max(0, container.scrollWidth - container.clientWidth);
      setAtEnd(container.scrollLeft >= maximum - 2);
      setOverflow(maximum > 2);
      const origin = (container.children[0] as HTMLElement)?.offsetLeft ?? 0;
      const pages = Array.from(new Set(Array.from(container.children).map(card => Math.min(maximum, (card as HTMLElement).offsetLeft - origin))));
      setPositions(pages.length ? pages : [0]);
      setActive(pages.reduce((nearest, position, index) => Math.abs(position - container.scrollLeft) < Math.abs(pages[nearest] - container.scrollLeft) ? index : nearest, 0));
      if (home || completeCards) setColumns(Math.max(1, Math.min(4, Math.floor(container.clientWidth / 260))));
    };
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    const frame = requestAnimationFrame(sync);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [items.length, home, completeCards, columns]);
  function go(index: number) {
    const container = ref.current;
    if (container) container.scrollTo({ left: positions[index] ?? 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className={`travel-collection ${single ? "single-collection" : ""} ${home ? "home-trip-collection" : ""} ${completeCards ? "complete-collection" : ""}`} style={home || completeCards ? { "--collection-columns": columns } as import("react").CSSProperties : undefined} role="group" aria-label={label} aria-roledescription={overflow ? "carrossel" : undefined}>
    <div ref={ref} className={`collection-scroll ${(home || completeCards) && items.length <= columns ? "collection-grid" : ""}`} onScroll={(event) => {
      const container = event.currentTarget;
      setActive(positions.reduce((nearest, position, index) => Math.abs(position - container.scrollLeft) < Math.abs(positions[nearest] - container.scrollLeft) ? index : nearest, 0));
      setAtEnd(container.scrollLeft + container.clientWidth >= container.scrollWidth - 2);
    }}>{items}</div>
    {overflow && <span className="sr-only" aria-live="polite">Página {active + 1} de {positions.length}</span>}
    {items.length > 1 && overflow && <>
      <Button variant="outline" size="icon" className="collection-arrow collection-arrow-prev rounded-full size-10 bg-surface hover:bg-surface disabled:opacity-100" aria-label={`${label}: anterior`} disabled={active === 0} onClick={() => go(Math.max(0, active - 1))}><ArrowLeft /></Button>
      <Button variant="outline" size="icon" className="collection-arrow collection-arrow-next rounded-full size-10 bg-surface hover:bg-surface disabled:opacity-100" aria-label={`${label}: próximo`} disabled={atEnd} onClick={() => go(Math.min(positions.length - 1, active + 1))}><ArrowRight /></Button>
      <div className="collection-pagination" role="group" aria-label={`Posição em ${label}`}>
        {positions.map((_, index) => <button key={index} type="button" aria-label={`Mostrar página ${index + 1}`} aria-current={index === active ? "true" : undefined} onClick={() => go(index)}><span /></button>)}
      </div>
    </>}
  </div>;
}
