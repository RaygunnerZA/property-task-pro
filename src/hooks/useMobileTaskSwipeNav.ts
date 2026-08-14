import { useCallback, useRef, type TouchEvent } from "react";

const SWIPE_PX = 72;
const HORIZONTAL_DOMINANCE = 1.25;

type SwipeStart = {
  x: number;
  y: number;
  ignore: boolean;
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return Boolean(el.closest("textarea, input, select, [contenteditable='true']"));
}

function isHorizontalScroller(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  let node: Element | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 8
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

type UseMobileTaskSwipeNavArgs = {
  enabled: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

/**
 * Horizontal finger swipe → previous / next task. Desktop chevrons stay the
 * pointer path; this is for viewports below `lg` only.
 */
export function useMobileTaskSwipeNav({
  enabled,
  onSwipeLeft,
  onSwipeRight,
}: UseMobileTaskSwipeNavArgs) {
  const startRef = useRef<SwipeStart | null>(null);

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        ignore: isTypingTarget(event.target) || isHorizontalScroller(event.target),
      };
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!enabled || !start || start.ignore) return;
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < SWIPE_PX) return;
      if (Math.abs(dx) <= Math.abs(dy) * HORIZONTAL_DOMINANCE) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    [enabled, onSwipeLeft, onSwipeRight]
  );

  const onTouchCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
