import { useEffect, useRef, type RefObject } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

const WHEEL_THRESHOLD = 80;
const WHEEL_DELTA_SCALE = 0.5;
/** Axis dominance threshold — horizontal vs vertical wheel routing. */
const WHEEL_AXIS_RATIO = 0.85;

function normalizeWheelDelta(delta: number, mode: number, pageSize: number): number {
  if (mode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
  if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * pageSize;
  return delta;
}

function isPrimarilyHorizontalWheel(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY) * WHEEL_AXIS_RATIO;
}

function isPrimarilyVerticalWheel(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaY) > Math.abs(deltaX) * WHEEL_AXIS_RATIO;
}

function findVerticalScrollTarget(from: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = from.parentElement;

  while (el) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflow = style.overflow;
    const scrollableY =
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflow === "auto" ||
      overflow === "scroll";

    if (scrollableY && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }

    el = el.parentElement;
  }

  const root = document.scrollingElement;
  return root instanceof HTMLElement ? root : null;
}

/** Scroll the page/column when wheel moves vertically over a horizontal carousel or row. */
function forwardVerticalWheelScroll(event: WheelEvent, from: HTMLElement, deltaY: number) {
  if (Math.abs(deltaY) < 0.5) return;

  const target = findVerticalScrollTarget(from);
  if (!target) return;

  event.preventDefault();
  target.scrollTop += deltaY;
}

/** Map horizontal wheel / trackpad swipe to scrollLeft; vertical wheel scrolls the column/page. */
export function useTrackpadHorizontalElementScroll(
  ref: RefObject<HTMLElement | null>,
  enabled = true
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;

      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, el.clientWidth);
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, el.clientHeight);

      if (isPrimarilyHorizontalWheel(deltaX, deltaY)) {
        if (Math.abs(deltaX) < 0.5) return;
        event.preventDefault();
        el.scrollLeft += deltaX;
        return;
      }

      if (isPrimarilyVerticalWheel(deltaX, deltaY)) {
        forwardVerticalWheelScroll(event, el, deltaY);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, enabled]);
}

/** Horizontal wheel advances the carousel; vertical wheel scrolls the column/page. */
export function useTrackpadCarouselWheel(api: CarouselApi | undefined, enabled = true) {
  const wheelAccumRef = useRef(0);

  useEffect(() => {
    if (!api || !enabled) return;
    const node = api.rootNode();

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;

      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, node.clientWidth);
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, node.clientHeight);

      if (isPrimarilyHorizontalWheel(deltaX, deltaY)) {
        if (Math.abs(deltaX) < 0.5) return;

        event.preventDefault();
        wheelAccumRef.current += deltaX * WHEEL_DELTA_SCALE;

        if (wheelAccumRef.current >= WHEEL_THRESHOLD) {
          api.scrollNext();
          wheelAccumRef.current = 0;
        } else if (wheelAccumRef.current <= -WHEEL_THRESHOLD) {
          api.scrollPrev();
          wheelAccumRef.current = 0;
        }
        return;
      }

      if (isPrimarilyVerticalWheel(deltaX, deltaY)) {
        forwardVerticalWheelScroll(event, node, deltaY);
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [api, enabled]);
}
