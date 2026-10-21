import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { claimReveal } from "../motion/reveal-state";

/** Presentation only: mark each initial content node once; later filter results stay still. */
export function ScreenEntrance() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!claimReveal(`screen:${pathname}`)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let finished = false;
    const mark = () => {
      if (finished || document.querySelector('.skeleton-block, [aria-busy="true"]')) return;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(".travel-card, .category-tile, .onboard-option, .planning-field, .trip-calendar, .choice-button, .page-content .rounded-card, .planning-controls, .trip-review-list, .itinerary-activity, .reference-panel, .auth-form-panel form, .auth-form form, .page-content > section, .page-content > .travel-grid, .feedback, .definition-list, .profile-section, .page-content > div, .creation-panel > div"));
      const nodes = candidates.filter(node => node.offsetParent !== null && !node.closest("aside, header, footer, .skeleton-card") && !node.querySelector("header, .page-header") && !candidates.some(other => other !== node && node.contains(other)));
      if (!nodes.length) return;
      nodes.forEach((node, index) => {
        node.style.setProperty("--entry-delay", `${Math.min(index, 6) * 50}ms`);
        // A filled entrance animation otherwise wins over the card's hover transform.
        const release = (event: AnimationEvent) => {
          if (event.target !== node || event.animationName !== "fade-up") return;
          node.classList.remove("motion-safe:animate-fade-up");
          node.removeEventListener("animationend", release);
          node.removeEventListener("animationcancel", release);
        };
        node.addEventListener("animationend", release);
        node.addEventListener("animationcancel", release);
        node.classList.add("motion-safe:animate-fade-up");
      });
      finished = true;
      observer.disconnect();
    };
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = requestAnimationFrame(mark);
    // A user action ends the entrance window, even if asynchronous data is pending.
    const stop = () => { finished = true; observer.disconnect(); };
    document.addEventListener("input", stop, { once: true });
    document.addEventListener("pointerdown", stop, { once: true });
    document.addEventListener("keydown", stop, { once: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("input", stop); document.removeEventListener("pointerdown", stop); document.removeEventListener("keydown", stop); };
  }, [pathname]);
  return null;
}
