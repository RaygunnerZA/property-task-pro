import { useCallback, useEffect, useRef, useState } from "react";

/** Delay after first home property-hero mount (per calendar day) before settle begins. */
export const PROPERTY_HERO_SETTLE_DELAY_MS = 30_000;
/** Duration of opacity + height settle / restore transition. */
export const PROPERTY_HERO_SETTLE_DURATION_MS = 3_000;
/** Hover must be held this long before the hero expands back to full size. */
export const PROPERTY_HERO_HOVER_EXPAND_DELAY_MS = 1_000;
/** Image opacity once settled (title overlays stay full strength). */
export const PROPERTY_HERO_SETTLED_OPACITY = 0.4;
/** Hero frame height reduction once settled. */
export const PROPERTY_HERO_HEIGHT_REDUCTION_PX = 49;
/** Filla turquoise underlay — visible as the photo settles. */
export const PROPERTY_HERO_UNDERLAY = "#8EC9CE";

const STORAGE_KEY = "filla:property-hero-settle-day";

type StoredSettle = {
  /** Local calendar day `YYYY-MM-DD`. */
  dayKey: string;
  /** Epoch ms when settle should activate. */
  deadlineMs: number;
};

/** In-memory mirror of today’s deadline so carousel remounts stay in sync. */
let memoryDeadlineMs: number | null = null;
let memoryDayKey: string | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readStored(): StoredSettle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSettle;
    if (
      typeof parsed?.dayKey !== "string" ||
      typeof parsed?.deadlineMs !== "number" ||
      !Number.isFinite(parsed.deadlineMs)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: StoredSettle) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
  memoryDayKey = value.dayKey;
  memoryDeadlineMs = value.deadlineMs;
}

/** Resolve today’s settle deadline; starts a new 30s clock when the calendar day rolls over. */
function ensureTodayDeadline(): number {
  const today = localDayKey();
  if (memoryDayKey === today && memoryDeadlineMs != null) {
    return memoryDeadlineMs;
  }

  const stored = readStored();
  if (stored && stored.dayKey === today) {
    memoryDayKey = stored.dayKey;
    memoryDeadlineMs = stored.deadlineMs;
    return stored.deadlineMs;
  }

  const deadlineMs = Date.now() + PROPERTY_HERO_SETTLE_DELAY_MS;
  writeStored({ dayKey: today, deadlineMs });
  return deadlineMs;
}

export type PropertyHeroSettleApi = {
  /** True when the hero should show the settled (dimmed / shorter) look. */
  settled: boolean;
  /** Pointer handlers — hover ~1s expands; leave re-settles. */
  hoverBind: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
};

/**
 * After {@link PROPERTY_HERO_SETTLE_DELAY_MS} on the home property card, settle to a calmer hero
 * (dimmed photo + shorter frame over turquoise). Resets each local calendar day.
 * Hovering the hero for {@link PROPERTY_HERO_HOVER_EXPAND_DELAY_MS} restores full size until leave.
 */
export function usePropertyHeroSettle(enabled = true): PropertyHeroSettleApi {
  const [daySettled, setDaySettled] = useState(() => {
    if (!enabled) return false;
    const deadline = ensureTodayDeadline();
    return Date.now() >= deadline;
  });
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDaySettled(false);
      setHoverExpanded(false);
      return;
    }

    const deadline = ensureTodayDeadline();
    const remaining = Math.max(0, deadline - Date.now());
    if (remaining === 0) {
      setDaySettled(true);
      return;
    }

    setDaySettled(false);
    const id = window.setTimeout(() => setDaySettled(true), remaining);
    return () => window.clearTimeout(id);
  }, [enabled]);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const onMouseEnter = useCallback(() => {
    if (!daySettled) return;
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverExpanded(true);
      hoverTimerRef.current = null;
    }, PROPERTY_HERO_HOVER_EXPAND_DELAY_MS);
  }, [clearHoverTimer, daySettled]);

  const onMouseLeave = useCallback(() => {
    clearHoverTimer();
    setHoverExpanded(false);
  }, [clearHoverTimer]);

  return {
    settled: enabled && daySettled && !hoverExpanded,
    hoverBind: { onMouseEnter, onMouseLeave },
  };
}

export function propertyHeroFrameHeight(baseHeightPx: number, settled: boolean): number {
  return settled ? Math.max(0, baseHeightPx - PROPERTY_HERO_HEIGHT_REDUCTION_PX) : baseHeightPx;
}

/** CSS transition for height/opacity settle (skipped when reduced motion). */
export function propertyHeroSettleTransition(): string | undefined {
  if (prefersReducedMotion()) return undefined;
  return `height ${PROPERTY_HERO_SETTLE_DURATION_MS}ms ease-in-out, opacity ${PROPERTY_HERO_SETTLE_DURATION_MS}ms ease-in-out`;
}

export function propertyHeroImageOpacity(settled: boolean): number {
  return settled ? PROPERTY_HERO_SETTLED_OPACITY : 1;
}
