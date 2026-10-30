import { useLayoutEffect, useRef, type ReactNode } from "react";

export function StepTransition({ step, children }: { step: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(step);
  useLayoutEffect(() => {
    if (previous.current !== step && ref.current) {
      ref.current.style.setProperty("--step-direction", step > previous.current ? "1" : "-1");
      ref.current.dataset.transition = String(step % 2);
    }
    previous.current = step;
  }, [step]);
  return <div ref={ref} className="motion-step-content">{children}</div>;
}
