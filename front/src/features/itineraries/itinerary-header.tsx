import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function ItineraryHeader({ children }: { children: (compact: boolean) => ReactNode }) {
  const marker = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const element = header.current;
    if (!element || compact) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);

  useLayoutEffect(() => {
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      const top = Number.parseFloat(getComputedStyle(slot.current!).top);
      observer = new IntersectionObserver(([entry]) => {
        setCompact(!entry.isIntersecting && entry.boundingClientRect.top <= top);
      }, { rootMargin: `-${top + 1}px 0px 0px 0px` });
      observer.observe(marker.current!);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => { observer.disconnect(); window.removeEventListener("resize", observe); };
  }, []);

  return <>
    <div ref={slot} className="itinerary-header-slot" data-compact={compact} style={{ minHeight: height }}>
      <div ref={marker} className="itinerary-header-marker" aria-hidden="true" />
      <header ref={header} className="page-header itinerary-adaptive-header">{children(compact)}</header>
    </div>
  </>;
}
