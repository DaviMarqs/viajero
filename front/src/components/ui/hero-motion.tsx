import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function HeroMotion() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const element = ref.current;
    if (!element) return;
    const media = gsap.matchMedia();
    let visible = true;
    let animations: gsap.core.Animation[] = [];
    const sync = () => {
      animations.forEach((animation) => {
        if (visible && !document.hidden) animation.resume();
        else animation.pause();
      });
    };
    media.add("(prefers-reduced-motion: no-preference)", () => {
      animations = [
        gsap.to(".hero-aura-blue", { xPercent: 5, yPercent: -3, scale: 1.02, duration: 24, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true }),
        gsap.to(".hero-aura-violet", { xPercent: -5, yPercent: -3, scale: 1.02, duration: 26, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true }),
        gsap.to(".hero-aura-cyan", { xPercent: 4, yPercent: -3, scale: 1.02, duration: 28, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true }),
      ];
      sync();
      return () => { animations = []; };
    }, element.parentElement ?? element);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); media.revert(); };
  }, { scope: ref });
  return <div ref={ref} className="hero-motion" aria-hidden="true">
    <div className="hero-aura hero-aura-blue" />
    <div className="hero-aura hero-aura-violet" />
    <div className="hero-aura hero-aura-cyan" />
  </div>;
}
