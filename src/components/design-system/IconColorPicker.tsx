import { useRef, useEffect, useCallback, useState, type LucideIcon } from "react";
import { cn } from "@/lib/utils";

export type IconColorPickerValue = {
  icon: string;
  color: string;
};

export type IconItem = {
  name: string;
  icon: LucideIcon;
  label?: string;
};

export type IconColorPickerProps = {
  value: IconColorPickerValue;
  onChange: (next: IconColorPickerValue) => void;
  icons: IconItem[];
  colors: string[];
  /** Optional class for the root container */
  className?: string;
};

/** Centred 44×44px "pressed" window; items this size align inside it */
const WINDOW_SIZE = 44;
const ITEM_SIZE = 44;
const GAP = 10;
/** Tighter spacing between colour swatches only */
const COLOR_GAP = 6;
const BLUR_MAX = 6;
const OPACITY_MIN = 0.25;
/** Distance from window centre beyond which blur/opacity ramp applies */
const WINDOW_RADIUS = WINDOW_SIZE / 2;

export function IconColorPicker({
  value,
  onChange,
  icons,
  colors,
  className,
}: IconColorPickerProps) {
  const iconScrollRef = useRef<HTMLDivElement>(null);
  const colorScrollRef = useRef<HTMLDivElement>(null);
  const iconOverlayRef = useRef<HTMLDivElement>(null);
  const iconItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colorItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const initialScrolledRef = useRef(false);
  const [iconStripWidth, setIconStripWidth] = useState(280);
  const [colorStripWidth, setColorStripWidth] = useState(280);

  const getIconIndex = useCallback(() => {
    const el = iconScrollRef.current;
    if (!el) return 0;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const center = scrollLeft + width / 2;
    const leftPad = (width - ITEM_SIZE) / 2;
    const index = Math.round((center - leftPad - ITEM_SIZE / 2) / (ITEM_SIZE + GAP));
    return Math.max(0, Math.min(index, icons.length - 1));
  }, [icons.length]);

  const getColorIndex = useCallback(() => {
    const el = colorScrollRef.current;
    if (!el) return 0;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const center = scrollLeft + width / 2;
    const leftPad = (width - ITEM_SIZE) / 2;
    const index = Math.round((center - leftPad - ITEM_SIZE / 2) / (ITEM_SIZE + COLOR_GAP));
    return Math.max(0, Math.min(index, colors.length - 1));
  }, [colors.length]);

  const snapIconToIndex = useCallback(
    (index: number) => {
      const el = iconScrollRef.current;
      if (!el) return;
      const width = el.clientWidth;
      const leftPad = (width - ITEM_SIZE) / 2;
      const targetScroll = leftPad + index * (ITEM_SIZE + GAP) - width / 2 + ITEM_SIZE / 2;
      el.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" });
    },
    []
  );

  const snapColorToIndex = useCallback(
    (index: number) => {
      const el = colorScrollRef.current;
      if (!el) return;
      const width = el.clientWidth;
      const leftPad = (width - ITEM_SIZE) / 2;
      const targetScroll = leftPad + index * (ITEM_SIZE + COLOR_GAP) - width / 2 + ITEM_SIZE / 2;
      el.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" });
    },
    []
  );

  /** Apply blur/opacity to icons: sharp and opaque inside 44×44 window, blurred/faint outside */
  const updateIconBlur = useCallback(() => {
    const el = iconScrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const stripCenter = scrollLeft + width / 2;
    const leftPad = (width - ITEM_SIZE) / 2;
    const falloffDist = width / 2 + ITEM_SIZE;
    iconItemRefs.current.forEach((item, i) => {
      if (!item) return;
      const itemCenter = leftPad + i * (ITEM_SIZE + GAP) + ITEM_SIZE / 2;
      const distance = Math.abs(itemCenter - stripCenter);
      if (distance < WINDOW_RADIUS) {
        item.style.filter = "none";
        item.style.opacity = "1";
      } else {
        const t = Math.min(1, (distance - WINDOW_RADIUS) / (falloffDist - WINDOW_RADIUS));
        item.style.filter = `blur(${t * BLUR_MAX}px)`;
        item.style.opacity = String(1 - t * (1 - OPACITY_MIN));
      }
    });
  }, []);

  /** Same blur/opacity ramp for colour swatches */
  const updateColorBlur = useCallback(() => {
    const el = colorScrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const stripCenter = scrollLeft + width / 2;
    const leftPad = (width - ITEM_SIZE) / 2;
    const falloffDist = width / 2 + ITEM_SIZE;
    colorItemRefs.current.forEach((item, i) => {
      if (!item) return;
      const itemCenter = leftPad + i * (ITEM_SIZE + COLOR_GAP) + ITEM_SIZE / 2;
      const distance = Math.abs(itemCenter - stripCenter);
      if (distance < WINDOW_RADIUS) {
        item.style.filter = "none";
        item.style.opacity = "1";
      } else {
        const t = Math.min(1, (distance - WINDOW_RADIUS) / (falloffDist - WINDOW_RADIUS));
        item.style.filter = `blur(${t * BLUR_MAX}px)`;
        item.style.opacity = String(1 - t * (1 - OPACITY_MIN));
      }
    });
  }, []);

  const handleScrollEnd = useCallback(() => {
    const iconIndex = getIconIndex();
    const colorIndex = getColorIndex();
    snapIconToIndex(iconIndex);
    snapColorToIndex(colorIndex);
    const nextIcon = icons[iconIndex]?.name ?? value.icon;
    const nextColor = colors[colorIndex] ?? value.color;
    if (nextIcon !== value.icon || nextColor !== value.color) {
      onChange({ icon: nextIcon, color: nextColor });
    }
  }, [getIconIndex, getColorIndex, snapIconToIndex, snapColorToIndex, icons, colors, value, onChange]);

  const scheduleSnap = useCallback(() => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(handleScrollEnd, 150);
  }, [handleScrollEnd]);

  useEffect(() => {
    const iconEl = iconScrollRef.current;
    const colorEl = colorScrollRef.current;
    if (!iconEl && !colorEl) return;

    const onScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        updateIconBlur();
        updateColorBlur();
        rafRef.current = null;
      });
      scheduleSnap();
    };

    iconEl?.addEventListener("scroll", onScroll, { passive: true });
    colorEl?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      iconEl?.removeEventListener("scroll", onScroll);
      colorEl?.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    };
  }, [updateIconBlur, updateColorBlur, scheduleSnap]);

  // Measure strip widths for padding (so first/last items can scroll to centre)
  useEffect(() => {
    const iconEl = iconScrollRef.current;
    const colorEl = colorScrollRef.current;
    if (!iconEl && !colorEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (e.target === iconEl) setIconStripWidth(w);
        if (e.target === colorEl) setColorStripWidth(w);
      }
    });
    if (iconEl) {
      setIconStripWidth(iconEl.getBoundingClientRect().width);
      ro.observe(iconEl);
    }
    if (colorEl) {
      setColorStripWidth(colorEl.getBoundingClientRect().width);
      ro.observe(colorEl);
    }
    return () => ro.disconnect();
  }, []);

  // Initial scroll to value once on mount + blur update
  useEffect(() => {
    if (initialScrolledRef.current) return;
    const iconIndex = Math.max(0, icons.findIndex((i) => i.name === value.icon));
    const colorIndex = Math.max(0, colors.indexOf(value.color));
    const ni = iconIndex >= 0 ? iconIndex : 0;
    const nc = colorIndex >= 0 ? colorIndex : 0;
    const t = requestAnimationFrame(() => {
      snapIconToIndex(ni);
      snapColorToIndex(nc);
      updateIconBlur();
      updateColorBlur();
      initialScrolledRef.current = true;
    });
    return () => cancelAnimationFrame(t);
  }, [icons.length, colors.length, snapIconToIndex, snapColorToIndex, updateIconBlur, updateColorBlur, value.icon, value.color]);

  const iconPad = (iconStripWidth - ITEM_SIZE) / 2;
  const colorPad = (colorStripWidth - ITEM_SIZE) / 2;
  const iconContentWidth = (icons.length * (ITEM_SIZE + GAP)) - GAP + 2 * iconPad;
  const colorContentWidth = (colors.length * (ITEM_SIZE + COLOR_GAP)) - COLOR_GAP + 2 * colorPad;

  /** Pressed neumorphism: recessed 44×44 window – static centred, content scrolls behind */
  const pressedWindowStyle: React.CSSProperties = {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    borderRadius: 10,
    backgroundColor: "transparent",
    boxShadow:
      "inset 3px 3px 5px 0px rgba(0, 0, 0, 0.25), inset -3px -3px 5px 0px rgba(255, 255, 255, 0.08)",
    pointerEvents: "none",
  };

  /** Paper texture overlay to left/right of window – dims icons below */
  const sideOverlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "calc(50% - 22px)",
    backgroundImage: "var(--paper-texture)",
    backgroundSize: "100%",
    backgroundColor: "hsl(var(--background))",
    opacity: 0.92,
    pointerEvents: "none",
  };

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-6", className)}>
      {/* Icon selector: wrapper has no overflow so overlay stays fixed; only inner div scrolls */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
          Choose an icon
        </label>
        <div
          className="relative"
          style={{ width: "100%", maxWidth: 280, height: WINDOW_SIZE + 8 }}
        >
          {/* Scroll container: only the strip is inside so only it scrolls */}
          <div
            ref={iconScrollRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden no-scrollbar"
            style={{ scrollSnapType: "x mandatory" }}
          >
            <div
              className="flex items-center gap-[10px] h-full"
              style={{
                paddingLeft: iconPad,
                paddingRight: iconPad,
                width: iconContentWidth,
                minWidth: "100%",
              }}
            >
              {icons.map(({ name, icon: Icon }, i) => (
                <div
                  key={name}
                  ref={(r) => {
                    iconItemRefs.current[i] = r;
                  }}
                  className="flex-shrink-0 flex items-center justify-center rounded-[10px] transition-[filter,opacity] duration-100"
                  style={{
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    scrollSnapAlign: "center",
                    backgroundColor: "#F6F4F2",
                    boxShadow:
                      name === value.icon
                        ? "inset 2px 2px 4px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.5)"
                        : "inset 1px 1px 2px rgba(0,0,0,0.06)",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Static overlay layer (sibling of scroll container): stays fixed, strip scrolls behind */}
          <div
            ref={iconOverlayRef}
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <div style={pressedWindowStyle} />
          </div>
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ ...sideOverlayStyle, left: 0 }}
            aria-hidden
          />
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ ...sideOverlayStyle, right: 0, left: "auto" }}
            aria-hidden
          />
        </div>
      </div>

      {/* Colour selector: same structure – overlay sibling of scroll container */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
          Choose a colour
        </label>
        <div
          className="relative"
          style={{ width: "100%", maxWidth: 280, height: WINDOW_SIZE + 8 }}
        >
          <div
            ref={colorScrollRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden no-scrollbar"
            style={{ scrollSnapType: "x mandatory" }}
          >
            <div
              className="flex items-center h-full"
              style={{
                gap: COLOR_GAP,
                paddingLeft: colorPad,
                paddingRight: colorPad,
                width: colorContentWidth,
                minWidth: "100%",
              }}
            >
              {colors.map((color, i) => (
                <div
                  key={color}
                  ref={(r) => {
                    colorItemRefs.current[i] = r;
                  }}
                  className="flex-shrink-0 rounded-[12px] transition-[filter,opacity] duration-100"
                  style={{
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    backgroundColor: color,
                    scrollSnapAlign: "center",
                    boxShadow:
                      value.color === color
                        ? "2px 2px 6px rgba(0,0,0,0.15), -1px -1px 4px rgba(255,255,255,0.5)"
                        : "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
          </div>
          <div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <div style={pressedWindowStyle} />
          </div>
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ ...sideOverlayStyle, left: 0 }}
            aria-hidden
          />
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ ...sideOverlayStyle, right: 0, left: "auto" }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
