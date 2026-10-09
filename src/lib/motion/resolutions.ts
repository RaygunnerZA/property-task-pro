/**
 * What happened to an item that just left a list.
 *
 * The code that resolves an item (save, dismiss, convert) notes the outcome
 * *after the write succeeds*. The list that renders the item reads it when the
 * item unmounts and plays the matching resolution motion. Nothing here changes
 * data — a missing note just means the item recedes without a destination.
 */

export type ResolutionOutcome =
  /** Kept on the property file as a Record. */
  | "filed"
  /** Became work. */
  | "task"
  /** Sent to Knowledge review (a candidate, not published). */
  | "knowledge"
  /** Removed without being kept. */
  | "dismissed";

export type ResolutionScope = "intake" | "inflow";

type ResolutionNote = {
  outcome: ResolutionOutcome;
  /** Resolved from inside a sheet/dialog: wait until it closes so the motion is visible. */
  afterOverlay: boolean;
  at: number;
};

const NOTE_TTL_MS = 15_000;
const notes = new Map<string, ResolutionNote>();

function key(scope: ResolutionScope, id: string) {
  return `${scope}:${id}`;
}

export function noteResolution(
  scope: ResolutionScope,
  id: string,
  outcome: ResolutionOutcome,
  options: { afterOverlay?: boolean } = {}
): void {
  notes.set(key(scope, id), {
    outcome,
    afterOverlay: options.afterOverlay ?? false,
    at: Date.now(),
  });
}

/** Read and clear. Stale notes (older than 15s) are ignored. */
export function takeResolution(
  scope: ResolutionScope,
  id: string
): Omit<ResolutionNote, "at"> | null {
  const k = key(scope, id);
  const note = notes.get(k);
  notes.delete(k);
  if (!note || Date.now() - note.at > NOTE_TTL_MS) return null;
  return { outcome: note.outcome, afterOverlay: note.afterOverlay };
}

export function forgetResolution(scope: ResolutionScope, id: string): void {
  notes.delete(key(scope, id));
}

const OPEN_OVERLAY_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/**
 * Resolves once no Radix dialog/sheet is open (or after `maxMs`), so resolution
 * motion plays on the visible surface rather than underneath a closing modal.
 * Radix flips data-state to "closed" when its exit animation starts, so a seen
 * overlay adds `exitMs` for the scrim to clear.
 */
export function waitForOverlaysClosed(maxMs = 4000, pollMs = 80, exitMs = 220): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const started = performance.now();
    let sawOverlay = false;
    const check = () => {
      const open = document.querySelector(OPEN_OVERLAY_SELECTOR);
      if (open) sawOverlay = true;
      if (!open || performance.now() - started > maxMs) {
        if (sawOverlay && !open) window.setTimeout(resolve, exitMs);
        else resolve();
        return;
      }
      window.setTimeout(check, pollMs);
    };
    check();
  });
}

export const RESOLUTION_DESTINATION_LABEL: Record<Exclude<ResolutionOutcome, "dismissed">, string> = {
  filed: "On file",
  task: "Tasks",
  knowledge: "Knowledge review",
};
