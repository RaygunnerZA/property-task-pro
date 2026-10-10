import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  favouriteKey,
  insertionIndex,
  sameFavourite,
  type FilterFavourite,
} from "@/lib/filterFavourites";

export type FavouriteDragSource = "menu" | "favourite";

export type FavouriteDragState = {
  item: FilterFavourite;
  source: FavouriteDragSource;
  overRow: boolean;
  overRemove: boolean;
  insertIndex: number;
  /** Source stays put until the pointer actually moves, so a click still lands. */
  hideSource: boolean;
};

type HoldMeta = {
  item: FilterFavourite;
  source: FavouriteDragSource;
  label: string;
};

type FavouriteDragContextValue = {
  drag: FavouriteDragState | null;
  onPointerDown: (event: React.PointerEvent<HTMLElement>, meta: HoldMeta) => void;
  consumeSuppressedClick: (event: React.MouseEvent) => void;
  isLifting: (item: FilterFavourite, source: FavouriteDragSource) => boolean;
};

const FavouriteDragContext = createContext<FavouriteDragContextValue | null>(null);

export function useFavouriteDrag(): FavouriteDragContextValue | null {
  return useContext(FavouriteDragContext);
}

/** Long enough that a click releases first. The chip lifts only after a still hold. */
const LIFT_MS = 450;
const LIFT_SHADOW = "4px 8px 18px rgba(0, 0, 0, 0.22)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function clearGhost(ghost: HTMLElement | null) {
  ghost?.remove();
}

type FavouriteDragProviderProps = {
  children: React.ReactNode;
  onDrop: (
    item: FilterFavourite,
    source: FavouriteDragSource,
    hit: { overRow: boolean; overRemove: boolean; insertIndex: number }
  ) => void;
};

export function FavouriteDragProvider({ children, onDrop }: FavouriteDragProviderProps) {
  const [drag, setDrag] = useState<FavouriteDragState | null>(null);
  const suppressClickRef = useRef(false);
  const ghostRef = useRef<HTMLElement | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => () => clearGhost(ghostRef.current), []);

  const consumeSuppressedClick = useCallback((event: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const isLifting = useCallback(
    (item: FilterFavourite, source: FavouriteDragSource) =>
      Boolean(drag && drag.source === source && sameFavourite(drag.item, item)),
    [drag]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, meta: HoldMeta) => {
      if (event.button !== 0) return;
      const host = event.currentTarget;
      const visual = (host.querySelector("button") ?? host) as HTMLElement;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let lifted = false;
      let moved = false;
      let offsetX = 0;
      let offsetY = 0;
      let latest = {
        overRow: false,
        overRemove: false,
        insertIndex: 0,
        hideSource: false,
      };

      const measure = (clientX: number, clientY: number) => {
        const remove = document.querySelector("[data-remove-favourite]");
        const row = document.querySelector("[data-favourites-row]");
        const overRemove = meta.source === "favourite" && containsPoint(remove, clientX, clientY);
        const overRow = !overRemove && containsPoint(row, clientX, clientY);
        const ignoreKey = meta.source === "favourite" ? favouriteKey(meta.item) : null;
        const mids: number[] = [];
        row?.querySelectorAll<HTMLElement>("[data-favourite-chip]").forEach((chip) => {
          if (ignoreKey && chip.dataset.favouriteKey === ignoreKey) return;
          const rect = chip.getBoundingClientRect();
          if (rect.width < 1) return;
          mids.push(rect.left + rect.width / 2);
        });
        return {
          overRow,
          overRemove,
          insertIndex: insertionIndex(mids, clientX),
          hideSource: moved,
        };
      };

      const publish = (next: typeof latest) => {
        latest = next;
        setDrag({
          item: meta.item,
          source: meta.source,
          ...next,
        });
      };

      const lift = () => {
        lifted = true;
        const rect = visual.getBoundingClientRect();
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;
        const ghost = visual.cloneNode(true) as HTMLElement;
        ghost.style.position = "fixed";
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.margin = "0";
        ghost.style.zIndex = "80";
        ghost.style.pointerEvents = "none";
        ghost.style.transform = "scale(1.05)";
        ghost.style.transformOrigin = "center center";
        ghost.style.boxShadow = LIFT_SHADOW;
        ghost.style.transition = prefersReducedMotion()
          ? "none"
          : "transform 140ms cubic-bezier(0.2, 0, 0, 1), box-shadow 140ms ease";
        document.body.appendChild(ghost);
        clearGhost(ghostRef.current);
        ghostRef.current = ghost;
        publish(measure(startX, startY));
      };

      const timer = window.setTimeout(lift, LIFT_MS);

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (!lifted) {
          if (distance > 6) {
            window.clearTimeout(timer);
            detach();
          }
          return;
        }
        if (distance > 4) moved = true;
        const ghost = ghostRef.current;
        if (ghost) {
          ghost.style.left = `${ev.clientX - offsetX}px`;
          ghost.style.top = `${ev.clientY - offsetY}px`;
        }
        const next = measure(ev.clientX, ev.clientY);
        if (
          next.overRow !== latest.overRow ||
          next.overRemove !== latest.overRemove ||
          next.insertIndex !== latest.insertIndex ||
          next.hideSource !== latest.hideSource
        ) {
          publish(next);
        }
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.clearTimeout(timer);
        detach();
        clearGhost(ghostRef.current);
        ghostRef.current = null;
        if (lifted && moved) {
          suppressClickRef.current = true;
          onDropRef.current(meta.item, meta.source, latest);
          // A real click follows pointerup. If this gesture never clicks, don't eat the next one.
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
        if (lifted) setDrag(null);
      };

      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    []
  );

  const value = useMemo(
    () => ({ drag, onPointerDown, consumeSuppressedClick, isLifting }),
    [consumeSuppressedClick, drag, isLifting, onPointerDown]
  );

  return (
    <FavouriteDragContext.Provider value={value}>{children}</FavouriteDragContext.Provider>
  );
}

function containsPoint(el: Element | null, x: number, y: number): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

type HoldToDragProps = {
  item: FilterFavourite;
  source: FavouriteDragSource;
  label: string;
  /** Marks a chip already in the favourites row so drop index can skip it. */
  inRow?: boolean;
  children: React.ReactNode;
};

export function HoldToDrag({ item, source, label, inRow = false, children }: HoldToDragProps) {
  const drag = useFavouriteDrag();
  if (!drag) return <>{children}</>;
  const lifting = drag.isLifting(item, source);
  return (
    <div
      className={lifting && drag.drag?.hideSource ? "hidden" : "inline-flex shrink-0"}
      data-favourite-chip={inRow ? "" : undefined}
      data-favourite-key={inRow ? favouriteKey(item) : undefined}
      onPointerDown={(event) => drag.onPointerDown(event, { item, source, label })}
      onClickCapture={drag.consumeSuppressedClick}
    >
      {children}
    </div>
  );
}
