import { useEffect, useRef, type RefObject } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

const WHEEL_THRESHOLD = 80;
const WHEEL_DELTA_SCALE = 0.5;

function dominantWheelDelta(deltaX: number, deltaY: number): number {
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
}

/** Map trackpad two-finger scroll (vertical or horizontal) to scrollLeft on a row. */
export function useTrackpadHorizontalElementScroll(
  ref: RefObject<HTMLElement | null>,
  enabled = true
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const delta = dominantWheelDelta(event.deltaX, event.deltaY);
      if (Math.abs(delta) < 0.5) return;

      event.preventDefault();
      el.scrollLeft += delta;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, enabled]);
}

/** Map trackpad two-finger scroll to Embla carousel snap navigation. */
export function useTrackpadCarouselWheel(api: CarouselApi | undefined, enabled = true) {
  const wheelAccumRef = useRef(0);

  useEffect(() => {
    if (!api || !enabled) return;
    const node = api.rootNode();

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const delta = dominantWheelDelta(event.deltaX, event.deltaY);
      if (Math.abs(delta) < 0.5) return;

      event.preventDefault();
      wheelAccumRef.current += delta * WHEEL_DELTA_SCALE;

      if (wheelAccumRef.current >= WHEEL_THRESHOLD) {
        api.scrollNext();
        wheelAccumRef.current = 0;
      } else if (wheelAccumRef.current <= -WHEEL_THRESHOLD) {
        api.scrollPrev();
        wheelAccumRef.current = 0;
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [api, enabled]);
}
