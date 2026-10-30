import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/** Presentation interpolation only; caller owns values and enables user-triggered animation. */
export function AnimatedNumber({ value, format = String, animate = false, durationToken = "--duration-number" }: { value: number; format?: (value: number) => string; animate?: boolean; durationToken?: "--duration-number" | "--duration-fast" }) {
  const reduced = useReducedMotion();
  const current = useRef(value);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const initial = current.current;
    let frame = 0;
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(durationToken)) || 300;
    const began = performance.now();
    function tick(now: number) {
      const progress = !animate || reduced ? 1 : Math.min(1, (now - began) / duration);
      current.current = initial + (value - initial) * (1 - (1 - progress) ** 3);
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, reduced, durationToken]);
  return <span aria-label={format(value)}><span aria-hidden="true">{format(display)}</span></span>;
}
