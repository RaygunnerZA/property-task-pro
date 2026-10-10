import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";

export type PropertyHubNavCardId = "spaces" | "assets" | "people" | "records";

/** Keep in sync with `public/property-hub/tab-shape.svg` (viewBox 0 0 300 130). */
export const TAB_SHAPE_PATH =
  "M 0 130 L 291 130 L 244 8 L 228 0 L 20 0 C 4 0 0 10 0 21 Z";

const TAB_SHAPE_MASK = "url(/property-hub/tab-shape.svg?v=130)";
/** Slant width as a fraction of tab width (291 − 228 over viewBox width). */
export const TAB_OVERLAP_RATIO = 63 / 300;
/** Extra horizontal space between stacked tabs. */
export const TAB_GAP_PX = 5;
/** Tab row chrome height (tabs sit `TAB_TOP_PX` below the top edge). */
export const TAB_ROW_HEIGHT_PX = 37;
/** Tab button + shape height. Active and inactive share this so the right slant matches. */
export const TAB_SHAPE_HEIGHT_PX = 35;
/** Painted overlap into the panel so the tab and body share one edge. */
export const TAB_SEAM_OVERLAP_PX = 3;
export const TAB_TOP_PX = 2;

const TAB_TITLE_FONT = '500 15px "Inter Tight", system-ui, -apple-system, sans-serif';
const TAB_COUNT_GAP_PX = 4;
const TAB_COUNT_BADGE_MIN_PX = 18;
const TAB_PAD_LEFT_FIRST = 20;
const TAB_PAD_X = 15;
const TAB_PAD_RIGHT_LAST = 17;
/** Horizontal padding inside the active tab title span (`px-1` + `ml-px`). */
const ACTIVE_TITLE_SPAN_PAD = 16;

let measureCanvas: HTMLCanvasElement | null = null;

export function measureTabTitleWidth(title: string): number {
  if (typeof document === "undefined") {
    return Math.ceil(title.length * 8.5);
  }
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return Math.ceil(title.length * 8.5);
  ctx.font = TAB_TITLE_FONT;
  return Math.ceil(ctx.measureText(title).width);
}

function countBadgeWidth(count: number): number {
  const digits = String(count).length;
  return Math.max(TAB_COUNT_BADGE_MIN_PX, digits * 7 + 8);
}

function tabLabelWidth(title: string, count?: number): number {
  if (count == null) return measureTabTitleWidth(title);
  return measureTabTitleWidth(title) + TAB_COUNT_GAP_PX + countBadgeWidth(count);
}

/** Natural tab button widths from title text + shape padding. */
export function tabWidthsFromTitles(titles: readonly string[], counts?: readonly number[]): number[] {
  return titles.map((title, index) => {
    const textWidth = tabLabelWidth(title, counts?.[index]);
    const left = index === 0 ? TAB_PAD_LEFT_FIRST : TAB_PAD_X;
    const right = index === titles.length - 1 ? TAB_PAD_RIGHT_LAST : TAB_PAD_X;
    const slantClear = index === titles.length - 1 ? 18 : 0;
    return textWidth + left + right + slantClear;
  });
}

function tabWidthAt(index: number, widths: readonly number[]): number {
  return widths[index] ?? widths[widths.length - 1] ?? 112;
}

/** Visible horizontal stride for tab at `index` (overlap excluded). */
export function tabVisibleStride(index: number, widths: readonly number[]): number {
  return tabWidthAt(index, widths) * (1 - TAB_OVERLAP_RATIO) + TAB_GAP_PX;
}

/** Left edge when `activeIndex` is brought to the front-left and others stack right. */
export function tabTargetLeft(
  activeIndex: number,
  tabIndex: number,
  stackSize: number,
  widths: readonly number[]
): number {
  if (tabIndex === activeIndex) return 0;

  const inactiveIndices: number[] = [];
  for (let i = 0; i < stackSize; i++) {
    if (i !== activeIndex) inactiveIndices.push(i);
  }

  const stackRank = inactiveIndices.indexOf(tabIndex);
  let left = tabVisibleStride(activeIndex, widths);
  for (let r = 0; r < stackRank; r++) {
    left += tabVisibleStride(inactiveIndices[r], widths);
  }
  return left;
}

export type TabStackLayout = {
  left: number;
  zIndex: number;
  isVisuallyLast: boolean;
  isVisuallyFront: boolean;
};

function inactiveTabIndices(activeIndex: number, stackSize: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < stackSize; i++) {
    if (i !== activeIndex) indices.push(i);
  }
  return indices;
}

export function getTabRowWidth(
  activeIndex: number,
  stackSize: number,
  widths: readonly number[]
): number {
  const inactiveIndices = inactiveTabIndices(activeIndex, stackSize);
  const trailingIndex =
    inactiveIndices.length > 0 ? inactiveIndices[inactiveIndices.length - 1] : activeIndex;
  return tabTargetLeft(activeIndex, trailingIndex, stackSize, widths) + tabWidthAt(trailingIndex, widths);
}

/** Scale tab widths so the stacked row fills `containerWidth`. */
export function scaleTabWidthsToContainer(
  containerWidth: number,
  activeIndex: number,
  stackSize: number,
  baseWidths: readonly number[]
): number[] {
  if (containerWidth <= 0) return [...baseWidths];

  const nominalWidth = getTabRowWidth(activeIndex, stackSize, baseWidths);
  if (nominalWidth <= 0) return [...baseWidths];

  const scale = containerWidth / nominalWidth;
  return baseWidths.map((width) => width * scale);
}

export function getTabStackLayout(
  activeIndex: number,
  tabIndex: number,
  stackSize: number,
  widths: readonly number[]
): TabStackLayout {
  const isActive = tabIndex === activeIndex;
  const targetLeft = tabTargetLeft(activeIndex, tabIndex, stackSize, widths);
  const inactiveIndices = inactiveTabIndices(activeIndex, stackSize);
  const stackRank = isActive ? -1 : inactiveIndices.indexOf(tabIndex);
  const isVisuallyLast = isActive
    ? inactiveIndices.length === 0
    : stackRank === inactiveIndices.length - 1;

  return {
    left: targetLeft,
    zIndex: isActive ? 35 : 30 - stackRank,
    isVisuallyLast,
    isVisuallyFront: isActive,
  };
}

const TAB_SHAPE_MASK_STYLE: CSSProperties = {
  WebkitMaskImage: TAB_SHAPE_MASK,
  maskImage: TAB_SHAPE_MASK,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};

/**
 * Match the masked tab silhouette so the active tab’s rectangular hit box
 * does not steal clicks from tabs stacked underneath (e.g. Assets under Spaces).
 * Coordinates are object-bounding-box percentages derived from {@link TAB_SHAPE_PATH}.
 */
const TAB_SHAPE_CLIP_PATH =
  "polygon(0% 100%, 97% 100%, 81.3% 6.2%, 76% 0%, 6.7% 0%, 0% 16.2%)";

const ACTIVE_FILL_SHADOW = "inset 1px 1px 1px 0px rgba(255, 255, 255, 1)";

const INACTIVE_FILL_SHADOW =
  "inset 1px 1px 1px 0px rgba(255, 255, 255, 0.6), inset 0px -13px 11px -10.6px rgba(1, 17, 65, 0.17)";

const SLANT_CAST_SHADOW = "drop-shadow(2px 0 2px rgba(0, 0, 0, 0.1))";

/** Debossed tab title letters — subtle 1px offset / 1px blur */
const TAB_TITLE_TEXT_SHADOW =
  "-1px -1px 1px rgba(0, 0, 0, 0.15), 1px 1px 1px rgba(255, 255, 255, 0.3)";

type PropertyHubTabProps = {
  id: string;
  title: string;
  count?: number;
  fill: string;
  isActive: boolean;
  isFirst: boolean;
  stackIndex: number;
  stackSize: number;
  activeIndex: number;
  tabWidths: readonly number[];
  onSelect: () => void;
};

export function PropertyHubTab({
  id,
  title,
  count,
  fill,
  isActive,
  isFirst: _isFirst,
  stackIndex,
  stackSize,
  activeIndex,
  tabWidths,
  onSelect,
}: PropertyHubTabProps) {
  const tabWidth = tabWidthAt(stackIndex, tabWidths);
  const shapeHeight = TAB_SHAPE_HEIGHT_PX + TAB_SEAM_OVERLAP_PX;
  const { left, zIndex, isVisuallyFront, isVisuallyLast } = getTabStackLayout(
    activeIndex,
    stackIndex,
    stackSize,
    tabWidths
  );
  const clearWidth = tabWidth * (1 - (isVisuallyLast ? 0.12 : TAB_OVERLAP_RATIO)) - 8;
  const showCount = count != null && tabLabelWidth(title, count) <= clearWidth;
  const labelWidth = tabLabelWidth(title, showCount ? count : undefined);

  return (
    <button
      type="button"
      id={`hub-tab-${id}`}
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        "absolute isolate min-w-0 overflow-visible border-0 pb-2 pt-2 text-center text-sm font-semibold leading-none",
        "transition-[left,width,height,top,color,filter] duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
      )}
      style={{
        left,
        height: shapeHeight,
        width: tabWidth,
        top: TAB_TOP_PX,
        paddingLeft: 6,
        paddingRight: 4,
        zIndex,
        clipPath: TAB_SHAPE_CLIP_PATH,
        WebkitClipPath: TAB_SHAPE_CLIP_PATH,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-tl-xl"
        style={{
          ...TAB_SHAPE_MASK_STYLE,
          ...paperTexturedColorStyle(fill),
          filter: isActive ? undefined : SLANT_CAST_SHADOW,
          boxShadow: isActive ? ACTIVE_FILL_SHADOW : INACTIVE_FILL_SHADOW,
        }}
      />
      <span
        className={cn(
          "relative z-[2] block max-w-full overflow-visible whitespace-nowrap text-left font-medium",
          isVisuallyFront && "ml-px px-1"
        )}
        style={{
          textShadow: TAB_TITLE_TEXT_SHADOW,
          ...(isVisuallyFront
            ? { width: labelWidth + ACTIVE_TITLE_SPAN_PAD }
            : undefined),
        }}
      >
        <span className="inline-flex items-center gap-1">
          <span className="text-[15px] font-medium leading-[21px]">{title}</span>
          {showCount && count != null ? (
            <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-white px-1 text-2xs font-bold tabular-nums leading-none text-foreground">
              {count}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
