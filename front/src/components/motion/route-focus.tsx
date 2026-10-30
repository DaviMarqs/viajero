import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map<string, number>();
const focusTargets = new Map<string, string>();

/** UI continuity only; leaves route definitions and data fetching untouched. */
export function RouteFocus() {
  const { key, pathname } = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    // Query filters can replace a history key while the user is typing.
    // Keep their scroll position and never refocus that same screen.
    let completed = previousPath.current === pathname;
    if (completed) positions.set(key, window.scrollY);
    previousPath.current = pathname;
    const scroll = () => positions.set(key, window.scrollY);
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLAnchorElement && event.target.closest("main")) focusTargets.set(key, event.target.getAttribute("href") || "");
    };
    const observer = new MutationObserver(ready);
    function ready() {
      if (completed || document.querySelector('main [aria-busy="true"],main .skeleton-block')) return;
      const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1, main .planning-heading h2, .auth-form h1, .auth-form-panel h1')).find(node => node.offsetParent !== null);
      if (!heading) return;
      completed = true;
      observer.disconnect();
      if (navigation === "POP" && positions.has(key)) {
        window.scrollTo({ top: positions.get(key)!, behavior: "instant" });
        const href = focusTargets.get(key);
        const link = href && Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href]')).find(node => node.getAttribute("href") === href);
        if (link) link.focus({ preventScroll: true });
      } else if (navigation !== "POP") {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    }
    const stop = () => { completed = true; observer.disconnect(); };
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = requestAnimationFrame(ready);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("focusin", remember);
    document.addEventListener("pointerdown", stop, { once: true });
    document.addEventListener("keydown", stop, { once: true });
    return () => {
      positions.set(key, window.scrollY);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("focusin", remember);
      document.removeEventListener("pointerdown", stop);
      document.removeEventListener("keydown", stop);
    };
  }, [key, pathname, navigation]);
  return null;
}
