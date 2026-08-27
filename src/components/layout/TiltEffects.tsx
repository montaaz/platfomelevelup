"use client";

import { useEffect } from "react";

/** Adds a subtle cursor-following 3D tilt to every .glass / .hero-gradient panel
 *  (delegated listeners — zero cost per card). Disabled on touch + reduced motion. */
export function TiltEffects() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const MAX = 3.5; // degrees
    let raf = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;

    const apply = () => {
      raf = 0;
      if (!pending) return;
      const { el, x, y } = pending;
      const r = el.getBoundingClientRect();
      const px = (x - r.left) / r.width - 0.5;
      const py = (y - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${(px * MAX * 2).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * MAX * 2).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tilt]");
      if (!el) return;
      pending = { el, x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tilt]");
      if (!el) return;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
