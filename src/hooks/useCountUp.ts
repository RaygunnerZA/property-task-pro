import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a numeric readout toward `target` with an ease-out ramp (rAF-driven).
 * Snaps instantly under prefers-reduced-motion. When `target` changes it
 * re-animates from the currently displayed value, so live data updates tick
 * rather than jump. Callers round the returned value for display.
 */
export function useCountUp(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? target : 0
  );
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target);
      return;
    }
    const from = displayRef.current;
    if (from === target) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(t >= 1 ? target : from + (target - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}
