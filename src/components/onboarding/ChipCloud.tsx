import {
  Children,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  CHIP_CLOUD_GAP_X_PX,
  CHIP_CLOUD_GAP_Y_PX,
  CHIP_HOVER_EXPAND_PX,
} from "./spaceGroupCardInputStyles";

function packChipRows(
  widths: number[],
  rowLimitPx: number,
  gapX: number
): number[][] {
  const rows: number[][] = [];
  let row: number[] = [];
  let used = 0;

  for (let i = 0; i < widths.length; i++) {
    const w = Math.max(0, widths[i] ?? 0);
    const next = row.length === 0 ? w : used + gapX + w;
    if (row.length > 0 && next > rowLimitPx) {
      rows.push(row);
      row = [i];
      used = w;
    } else {
      row.push(i);
      used = next;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

function childIdentity(children: ReactNode): string {
  return Children.toArray(children)
    .map((child, index) =>
      isValidElement(child) && child.key != null ? String(child.key) : `i${index}`
    )
    .join("|");
}

type ChipCloudProps = {
  children: ReactNode;
  className?: string;
  /** Free space kept on the right of every row for hover-expand. */
  expandReservePx?: number;
  gapXPx?: number;
  gapYPx?: number;
  /** Cap visible height to this many rows; overflow scrolls. */
  maxRows?: number;
};

/**
 * Packs chips into rows that fill the container width minus a hover-expand
 * reserve — so a chip can grow on hover without overlapping neighbours or
 * clipping the card edge.
 */
export function ChipCloud({
  children,
  className,
  expandReservePx = CHIP_HOVER_EXPAND_PX,
  gapXPx = CHIP_CLOUD_GAP_X_PX,
  gapYPx = CHIP_CLOUD_GAP_Y_PX,
  maxRows,
}: ChipCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<number, HTMLDivElement>());
  const [containerWidth, setContainerWidth] = useState(0);
  const [itemWidths, setItemWidths] = useState<number[]>([]);

  const childArray = Children.toArray(children);
  const identity = childIdentity(children);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure once per children/width change — do not remeasure when rows
  // reshuffle or clicks get cancelled mid-flight.
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const next = childArray.map((_, i) => itemRefs.current.get(i)?.offsetWidth ?? 0);
      setItemWidths((prev) => {
        if (prev.length === next.length && prev.every((w, i) => w === next[i])) {
          return prev;
        }
        return next;
      });
    };
    measure();
    // Refs may not be ready on the first pass (first paint = single measure row).
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity covers child keys
  }, [identity, containerWidth, childArray.length]);

  const rows = useMemo(() => {
    const count = childArray.length;
    if (count === 0) return [] as number[][];

    const rowLimit = Math.max(0, containerWidth - expandReservePx);
    if (
      containerWidth <= 0 ||
      itemWidths.length !== count ||
      itemWidths.every((w) => w === 0)
    ) {
      return [Array.from({ length: count }, (_, i) => i)];
    }

    return packChipRows(
      itemWidths.map((w) => (w > 0 ? w : 40)),
      rowLimit > 0 ? rowLimit : containerWidth,
      gapXPx
    );
  }, [childArray.length, containerWidth, expandReservePx, gapXPx, itemWidths]);

  const maxHeight =
    typeof maxRows === "number" && maxRows > 0
      ? maxRows * 28 + Math.max(0, maxRows - 1) * gapYPx
      : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full min-w-0",
        maxHeight != null && "overflow-x-hidden overflow-y-auto overscroll-y-contain",
        className
      )}
      style={maxHeight != null ? { maxHeight } : undefined}
    >
      <div className="flex w-full min-w-0 flex-col" style={{ rowGap: gapYPx }}>
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex min-w-0 flex-row flex-nowrap items-start"
            style={{
              columnGap: gapXPx,
              maxWidth:
                containerWidth > expandReservePx
                  ? containerWidth - expandReservePx
                  : undefined,
            }}
          >
            {row.map((index) => {
              const child = childArray[index];
              const key =
                isValidElement(child) && child.key != null
                  ? String(child.key)
                  : `chip-${index}`;
              return (
                <div
                  key={key}
                  ref={(node) => {
                    if (node) itemRefs.current.set(index, node);
                    else itemRefs.current.delete(index);
                  }}
                  className="inline-flex max-w-full shrink-0"
                >
                  {child}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
