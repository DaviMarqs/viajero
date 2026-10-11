import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function HeroMotion() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
        gsap.to(".hero-aura-blue", { xPercent: 24, yPercent: -24, scale: 1.12, duration: 8, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true }),
        gsap.to(".hero-aura-violet", { xPercent: -24, yPercent: -26, scale: 1.15, duration: 10, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true }),
        gsap.to(".hero-aura-cyan", { xPercent: 16, yPercent: -20, scale: 1.1, duration: 7, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true }),
      ];
      sync();
      return () => { animations = []; };
    }, element.parentElement ?? element);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); media.revert(); };
  }, []);
  return <div ref={ref} className="hero-motion" aria-hidden="true">
    <div className="hero-aura hero-aura-blue" />
    <div className="hero-aura hero-aura-violet" />
    <div className="hero-aura hero-aura-cyan" />
  </div>;
}
