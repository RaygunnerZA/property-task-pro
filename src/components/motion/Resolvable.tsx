import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useAnimate, usePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SCALE,
  MOTION_SPRING,
  transitions,
} from "@/lib/motion/tokens";
import {
  RESOLUTION_DESTINATION_LABEL,
  takeResolution,
  waitForOverlaysClosed,
  type ResolutionOutcome,
  type ResolutionScope,
} from "@/lib/motion/resolutions";
import { useFillaReducedMotion } from "./MotionSequence";
import { SettleValue } from "./Settle";
import { SheetStack } from "./SheetStack";

type KeptOutcome = Exclude<ResolutionOutcome, "dismissed">;

const LEDGER_LINGER_MS = 1800;

type LedgerContextValue = {
  counts: Record<KeptOutcome, number>;
  expected: Set<KeptOutcome>;
  /** True while something is resolving or just arrived; keep the host surface mounted. */
  active: boolean;
  expect: (outcome: KeptOutcome) => void;
  arrive: (outcome: KeptOutcome) => void;
  begin: () => void;
  end: () => void;
  registerTarget: (outcome: KeptOutcome, node: HTMLElement | null) => void;
  getTarget: (outcome: KeptOutcome) => HTMLElement | null;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

const EMPTY_COUNTS: Record<KeptOutcome, number> = { filed: 0, task: 0, knowledge: 0 };

/**
 * Holds the destinations ("On file", "Tasks", "Knowledge review") that resolved
 * items travel into, and how many arrived this visit. Wrap the list and its header.
 */
export function ResolutionLedgerProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [expected, setExpected] = useState<Set<KeptOutcome>>(new Set());
  const [pending, setPending] = useState(0);
  const [lingering, setLingering] = useState(false);
  const targets = useRef(new Map<KeptOutcome, HTMLElement>());
  const lingerTimer = useRef<number | undefined>();

  useEffect(() => () => window.clearTimeout(lingerTimer.current), []);

  const expect = useCallback((outcome: KeptOutcome) => {
    setExpected((prev) => (prev.has(outcome) ? prev : new Set(prev).add(outcome)));
  }, []);

  const arrive = useCallback((outcome: KeptOutcome) => {
    setCounts((prev) => ({ ...prev, [outcome]: prev[outcome] + 1 }));
    setLingering(true);
    window.clearTimeout(lingerTimer.current);
    lingerTimer.current = window.setTimeout(() => setLingering(false), LEDGER_LINGER_MS);
  }, []);

  const begin = useCallback(() => setPending((n) => n + 1), []);
  const end = useCallback(() => setPending((n) => Math.max(0, n - 1)), []);

  const registerTarget = useCallback((outcome: KeptOutcome, node: HTMLElement | null) => {
    if (node) targets.current.set(outcome, node);
    else targets.current.delete(outcome);
  }, []);
  const getTarget = useCallback((outcome: KeptOutcome) => targets.current.get(outcome) ?? null, []);

  const active = pending > 0 || lingering;

  // Counts describe this visit only; reset once the surface goes idle.
  useEffect(() => {
    if (active) return;
    setCounts(EMPTY_COUNTS);
    setExpected(new Set());
  }, [active]);

  const value = useMemo(
    () => ({ counts, expected, active, expect, arrive, begin, end, registerTarget, getTarget }),
    [counts, expected, active, expect, arrive, begin, end, registerTarget, getTarget]
  );
  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useResolutionLedger() {
  return useContext(LedgerContext);
}

/**
 * STACK destination tokens. Render in the list header. A token appears when an
 * item is on its way, and its count ticks when the item lands.
 */
export function ResolutionLedger({ className }: { className?: string }) {
  const ledger = useResolutionLedger();
  if (!ledger) return null;
  const outcomes = (Object.keys(RESOLUTION_DESTINATION_LABEL) as KeptOutcome[]).filter(
    (outcome) => ledger.expected.has(outcome) || ledger.counts[outcome] > 0
  );

  return (
    <div className={cn("flex items-center gap-3", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {outcomes.map((outcome) => (
          <motion.span
            key={outcome}
            ref={(node: HTMLSpanElement | null) => ledger.registerTarget(outcome, node)}
            className="inline-flex items-center gap-1.5 font-mono text-2xs uppercase text-muted-foreground"
            initial={{ opacity: 0, y: MOTION_DISTANCE.nudge }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: transitions.exit }}
            transition={transitions.quick}
          >
            <SheetStack arrivals={ledger.counts[outcome]} />
            <span>{RESOLUTION_DESTINATION_LABEL[outcome]}</span>
            {ledger.counts[outcome] > 0 ? (
              <SettleValue value={String(ledger.counts[outcome])} className="tabular-nums text-foreground" />
            ) : null}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Wrap a list whose items can be resolved. Initial items render still;
 * later additions unfold in.
 */
export function ResolvableList({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

/**
 * One resolvable row. Must be the direct, keyed child of ResolvableList.
 *
 * When it unmounts it reads what happened (`noteResolution`) and resolves
 * spatially:
 * - filed / knowledge / task → condenses into a sheet and travels into its
 *   ledger destination (STACK). Knowledge stays retained; the path shows it.
 * - dismissed (or unknown) → recedes in place, with no destination.
 * Siblings then close the gap with a layout (transform) shift.
 *
 * Put `data-resolve-content` on the inner content so it can clear first.
 */
export function ResolvableItem({
  id,
  scope,
  className,
  children,
}: {
  id: string;
  scope: ResolutionScope;
  className?: string;
  children: ReactNode;
}) {
  const [isPresent, safeToRemove] = usePresence();
  const [scopeRef, animate] = useAnimate<HTMLDivElement>();
  const ledger = useResolutionLedger();
  const reduced = useFillaReducedMotion();
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;

  useEffect(() => {
    if (isPresent) return;
    let cancelled = false;
    const el = scopeRef.current;

    const run = async () => {
      const note = takeResolution(scope, id);
      const outcome: ResolutionOutcome = note?.outcome ?? "dismissed";
      const kept = outcome === "dismissed" ? null : outcome;
      const ledgerNow = ledgerRef.current;
      ledgerNow?.begin();
      if (kept) ledgerNow?.expect(kept);
      try {
        if (!el) return;
        el.style.pointerEvents = "none";
        el.setAttribute("aria-hidden", "true");
        if (note?.afterOverlay) await waitForOverlaysClosed();
        if (cancelled) return;

        if (reduced) {
          if (kept) ledgerRef.current?.arrive(kept);
          return;
        }

        if (!kept) {
          await animate(
            el,
            { opacity: 0, scale: MOTION_SCALE.recede },
            { duration: MOTION_DURATION.quick, ease: MOTION_EASE.in }
          );
          return;
        }

        await nextFrame();
        const target = ledgerRef.current?.getTarget(kept) ?? null;
        const content = el.querySelectorAll<HTMLElement>("[data-resolve-content]");
        el.style.position = "relative";
        el.style.zIndex = "20";
        el.style.transformOrigin = "0 0";

        await Promise.all([
          content.length
            ? animate(Array.from(content), { opacity: 0 }, { duration: MOTION_DURATION.tap, ease: MOTION_EASE.in })
            : Promise.resolve(),
          animate(el, { y: -MOTION_DISTANCE.hair }, { duration: MOTION_DURATION.tap, ease: MOTION_EASE.out }),
        ]);
        if (cancelled) return;

        if (target) {
          const from = el.getBoundingClientRect();
          const to = target.getBoundingClientRect();
          const sheetW = 14;
          const sheetH = 10;
          await animate(
            el,
            {
              x: to.left - from.left,
              y: -MOTION_DISTANCE.hair + to.top - from.top + (to.height - sheetH) / 2,
              scaleX: sheetW / Math.max(from.width, 1),
              scaleY: sheetH / Math.max(from.height, 1),
              opacity: [1, 1, 0],
            },
            {
              duration: MOTION_DURATION.travel,
              ease: MOTION_EASE.paper,
              opacity: { duration: MOTION_DURATION.travel, times: [0, 0.75, 1] },
            }
          );
        } else {
          // No visible destination: press flat in place, the way a sheet joins a pile.
          await animate(
            el,
            { scaleY: 0.2, y: MOTION_DISTANCE.rise, opacity: 0 },
            { duration: MOTION_DURATION.settle, ease: MOTION_EASE.paper }
          );
        }
        ledgerRef.current?.arrive(kept);
      } finally {
        ledgerNow?.end();
        if (!cancelled) safeToRemove?.();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  return (
    <motion.div
      layout="position"
      initial={reduced ? false : { opacity: 0, y: MOTION_DISTANCE.nudge }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: MOTION_SPRING.layer, ...transitions.reveal }}
    >
      {/* Imperative resolution motion runs on this inner layer so it never fights layout projection. */}
      <div ref={scopeRef} className={className}>
        {children}
      </div>
    </motion.div>
  );
}
