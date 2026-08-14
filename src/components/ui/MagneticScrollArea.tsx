import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Distance (px) from a viewport edge over which cards compress and fade. */
const EDGE_ZONE_PX = 84;
/** Scroll distance (px) over which the edge shadow ramps to full strength. */
const SHADOW_RAMP_PX = 32;
const MIN_OPACITY = 0.08;
const MIN_SCALE_Y = 0.9;
const MIN_SCALE_X = 0.985;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type MagneticScrollAreaProps = {
  children: ReactNode;
  /** Outer wrapper (owns the edge shadows). Give it the flex sizing, e.g. `flex-1 min-h-0`. */
  className?: string;
  /** Inner scroll viewport — put horizontal padding here so cards aren't clipped. */
  viewportClassName?: string;
  /** Elements that squish/fade at the viewport edges. */
  itemSelector?: string;
};

/**
 * Scroll container for workbench lists (Tasks, Messages, Schedule).
 *
 * - The list scrolls internally instead of the page.
 * - Cards compress vertically and fade as they enter/exit the viewport edges
 *   (scroll-linked, no transitions — stays glued to the finger/wheel).
 * - A 10px shadow gradient appears at the top/bottom while content is hidden
 *   beyond that edge.
 * - Subtle magnetism via `scroll-snap: y proximity` (see `.magnetic-scroll-viewport`
 *   rules in index.css, which also relax the `.list-stagger` fill mode so the
 *   scroll-linked inline styles win once the entry animation finishes).
 */
export const MagneticScrollArea = forwardRef<HTMLDivElement, MagneticScrollAreaProps>(
  function MagneticScrollArea(
    { children, className, viewportClassName, itemSelector = ".list-stagger > *" },
    ref
  ) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const topShadowRef = useRef<HTMLDivElement | null>(null);
    const bottomShadowRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef(0);

    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const update = () => {
        rafRef.current = 0;
        const rect = viewport.getBoundingClientRect();
        const maxScroll = viewport.scrollHeight - viewport.clientHeight;
        const canScroll = maxScroll > 1;

        if (topShadowRef.current) {
          topShadowRef.current.style.opacity = canScroll
            ? String(clamp01(viewport.scrollTop / SHADOW_RAMP_PX))
            : "0";
        }
        if (bottomShadowRef.current) {
          bottomShadowRef.current.style.opacity = canScroll
            ? String(clamp01((maxScroll - viewport.scrollTop) / SHADOW_RAMP_PX))
            : "0";
        }
        if (reduceMotion || !canScroll) return;

        const items = viewport.querySelectorAll<HTMLElement>(itemSelector);
        items.forEach((item) => {
          const r = item.getBoundingClientRect();
          if (r.height <= 0) return;

          const zone = Math.min(EDGE_ZONE_PX, Math.max(48, r.height * 0.9));
          const topProgress = clamp01((r.bottom - rect.top) / zone);
          const bottomProgress = clamp01((rect.bottom - r.top) / zone);
          const eased = easeOutCubic(Math.min(topProgress, bottomProgress));

          if (eased >= 0.999) {
            if (item.dataset.magneticActive) {
              delete item.dataset.magneticActive;
              item.style.opacity = "";
              item.style.transform = "";
              item.style.transformOrigin = "";
              item.style.willChange = "";
            }
            return;
          }

          item.dataset.magneticActive = "1";
          // Squish toward the edge the card is leaving/entering.
          item.style.transformOrigin =
            topProgress < bottomProgress ? "center top" : "center bottom";
          item.style.opacity = String(MIN_OPACITY + (1 - MIN_OPACITY) * eased);
          const sx = MIN_SCALE_X + (1 - MIN_SCALE_X) * eased;
          const sy = MIN_SCALE_Y + (1 - MIN_SCALE_Y) * eased;
          item.style.transform = `scale3d(${sx}, ${sy}, 1)`;
          item.style.willChange = "transform, opacity";
        });
      };

      const schedule = () => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(update);
      };

      viewport.addEventListener("scroll", schedule, { passive: true });
      const resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(viewport);
      // childList only — our own style writes (attribute mutations) don't retrigger.
      const mutationObserver = new MutationObserver(schedule);
      mutationObserver.observe(viewport, { childList: true, subtree: true });
      schedule();

      return () => {
        viewport.removeEventListener("scroll", schedule);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          // Must reset — StrictMode re-runs this effect, and a stale id would
          // make `schedule` think a frame is forever pending.
          rafRef.current = 0;
        }
      };
    }, [itemSelector]);

    return (
      <div className={cn("relative flex min-h-0 flex-col", className)}>
        <div
          ref={(node) => {
            viewportRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          className={cn(
            "magnetic-scroll-viewport min-h-0 flex-1 overflow-y-auto overscroll-contain",
            viewportClassName
          )}
        >
          {children}
        </div>
        <div
          ref={topShadowRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[10px] rounded-t-2xl bg-gradient-to-b from-black/[0.14] via-black/[0.05] to-transparent opacity-0 transition-opacity duration-200"
        />
        <div
          ref={bottomShadowRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[10px] rounded-b-2xl bg-gradient-to-t from-black/[0.1] via-black/[0.04] to-transparent opacity-0 transition-opacity duration-200"
        />
      </div>
    );
  }
);
