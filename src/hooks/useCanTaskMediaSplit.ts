import { useSyncExternalStore } from "react";

/** Target width for the task-detail pane in the media-split modal. */
export const TASK_MEDIA_SPLIT_DETAIL_PX = 400;

/**
 * Side-by-side needs room for a ~400px detail pane plus an image pane that is
 * at least as wide (50|50). Modal gutters are `1rem` each side (`2rem` total).
 */
export const TASK_MEDIA_SPLIT_MIN_VIEWPORT_PX = TASK_MEDIA_SPLIT_DETAIL_PX * 2 + 32;

function subscribeMediaSplitViewport(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(`(min-width: ${TASK_MEDIA_SPLIT_MIN_VIEWPORT_PX}px)`);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getMediaSplitViewportSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${TASK_MEDIA_SPLIT_MIN_VIEWPORT_PX}px)`).matches;
}

/**
 * True when the viewport can host image | details at ≥50|50 with a ~400px detail pane.
 * Below this, use the stacked vertical task detail (hero in the scroll body).
 */
export function useCanTaskMediaSplit() {
  return useSyncExternalStore(
    subscribeMediaSplitViewport,
    getMediaSplitViewportSnapshot,
    () => false
  );
}
