"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  delayMs?: number;
};

export function LandingReveal({ children, className, id, delayMs = 0 }: LandingRevealProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const top = section.getBoundingClientRect().top;
    const initiallyVisible = top <= window.innerHeight * 0.9;
    if (initiallyVisible) return;

    const rafId = window.requestAnimationFrame(() => setIsVisible(false));

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    observer.observe(section);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const style: CSSProperties = { transitionDelay: `${delayMs}ms` };

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`landing-reveal ${isVisible ? "landing-reveal-visible" : "landing-reveal-hidden"} ${className ?? ""}`.trim()}
      style={style}
    >
      {children}
    </section>
  );
}
