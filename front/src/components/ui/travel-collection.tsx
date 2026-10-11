import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "./button";

export function TravelCollection({ children, label, single = false }: { children: ReactNode; label: string; single?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const items = Children.toArray(children);
  const [atEnd, setAtEnd] = useState(items.length < (single ? 2 : 3));
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const sync = () => setAtEnd(container.scrollLeft + container.clientWidth >= container.scrollWidth - 2);
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    const frame = requestAnimationFrame(sync);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [items.length]);
  function go(index: number) {
    const container = ref.current;
    const card = container?.children[index] as HTMLElement | undefined;
    if (container && card) container.scrollTo({ left: card.offsetLeft - (container.children[0] as HTMLElement).offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className={`travel-collection ${single ? "single-collection" : ""}`}>
    <div ref={ref} className="collection-scroll" aria-label={label} onScroll={(event) => {
      const container = event.currentTarget;
      const width = (container.children[0] as HTMLElement)?.offsetWidth ?? 1;
      setActive(Math.round(container.scrollLeft / (width + 16)));
      setAtEnd(container.scrollLeft + container.clientWidth >= container.scrollWidth - 2);
    }}>{items}</div>
    {items.length > 1 && <>
      <Button variant="outline" size="icon" className="collection-arrow collection-arrow-prev bg-white hover:bg-white disabled:opacity-100" aria-label={`${label}: anterior`} disabled={active === 0} onClick={() => go(Math.max(0, active - 1))}><ArrowLeft /></Button>
      <Button variant="outline" size="icon" className="collection-arrow collection-arrow-next bg-white hover:bg-white disabled:opacity-100" aria-label={`${label}: próximo`} disabled={atEnd} onClick={() => go(Math.min(items.length - 1, active + 1))}><ArrowRight /></Button>
      <div className="collection-pagination" role="group" aria-label={`Posição em ${label}`}>
        {items.map((_, index) => <button key={index} type="button" aria-label={`Mostrar item ${index + 1}`} aria-current={index === active ? "true" : undefined} onClick={() => go(index)}><span /></button>)}
      </div>
    </>}
  </div>;
}
