/**
 * IntakeChipRow — Rows under the composer when a section is open:
 * Row 1: Section icon rail (scroll + optional fade).
 * Row 2: Category actions (+ Person / inputs / quick dates) — single horizontal scroller.
 * Row 3: Suggestions for that section — one horizontal scroller.
 * Row 4: Summary (AI / fact) chips — one horizontal scroller.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, User, MapPin, Calendar, Box, AlertTriangle, Tag, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { SemanticChip, type EpistemicState } from "@/components/chips/semantic";

export type IntakeChipSlotId = "who" | "where" | "when" | "asset" | "priority" | "category" | "compliance";

const SLOTS: { id: IntakeChipSlotId; icon: typeof User; title: string }[] = [
  { id: "who", icon: User, title: "Assign" },
  { id: "where", icon: MapPin, title: "Location" },
  { id: "when", icon: Calendar, title: "Date" },
  { id: "asset", icon: Box, title: "Asset" },
  { id: "priority", icon: AlertTriangle, title: "Priority" },
  { id: "category", icon: Tag, title: "Tag" },
  { id: "compliance", icon: Shield, title: "Compliance" },
];

const RAIL_ICON_PX = 24;
const RAIL_FADE_TEXTURE_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to left, hsl(var(--background) / 0.98) 0%, hsl(var(--background) / 0.88) 48%, transparent 100%), var(--paper-texture)",
  backgroundSize: "100% 100%, 100%",
  backgroundRepeat: "no-repeat, repeat",
  backgroundPosition: "right center, center",
};

const HORIZONTAL_ROW_FADE_STYLE: CSSProperties = {
  background: "linear-gradient(270deg, rgba(235, 231, 224, 0.98) 50%, rgba(243, 241, 237, 0) 88%)",
};

/** Horizontal chip scroller: hidden scrollbar, right fade + glowing teal chevron when overflowed */
function HorizontalOverflowRow({ children, className }: { children: ReactNode; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
    setShowRightFade(overflow && !atEnd);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFade();
    const ro = new ResizeObserver(() => updateFade());
    ro.observe(el);
    const mo = new MutationObserver(() => updateFade());
    mo.observe(el, { childList: true, subtree: true });
    el.addEventListener("scroll", updateFade, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", updateFade);
    };
  }, [updateFade]);

  return (
    <div className="relative w-full min-w-0">
      <div ref={scrollRef} className={cn(className)}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-10 items-center justify-end pr-0.5 transition-opacity duration-200",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
        style={HORIZONTAL_ROW_FADE_STYLE}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-[#85BABC]",
            "drop-shadow-[0_0_6px_rgba(142,201,206,0.85)]",
            "animate-[chip-chevron-glow_2.4s_ease-in-out_infinite]"
          )}
          strokeWidth={2.25}
        />
      </div>
    </div>
  );
}

const SCROLLER_ROW_CLASS = cn(
  "flex min-h-7 flex-wrap items-center gap-1 overflow-x-auto overflow-y-hidden py-1 no-scrollbar"
);

export interface IntakeSlotPanelRows {
  row2: React.ReactNode;
  row3: React.ReactNode;
}

export interface IntakeChipRowChip {
  id: string;
  slot: IntakeChipSlotId;
  label: string;
  epistemic: EpistemicState;
  onPress?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}

export interface IntakeChipRowProps {
  chips: IntakeChipRowChip[];
  onOpenSlot: (slot: IntakeChipSlotId) => void;
  openSlot: IntakeChipSlotId | null;
  onCloseSlot: () => void;
  renderSlotContent: (slot: IntakeChipSlotId, onClose: () => void) => IntakeSlotPanelRows;
  className?: string;
}

export function IntakeChipRow({
  chips,
  onOpenSlot,
  openSlot,
  onCloseSlot,
  renderSlotContent,
  className,
}: IntakeChipRowProps) {
  const railScrollRef = useRef<HTMLDivElement>(null);
  const [railShowRightFade, setRailShowRightFade] = useState(false);

  const updateRailFade = useCallback(() => {
    const el = railScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
    setRailShowRightFade(overflow && !atEnd);
  }, []);

  useEffect(() => {
    const el = railScrollRef.current;
    if (!el) return;
    updateRailFade();
    const ro = new ResizeObserver(() => updateRailFade());
    ro.observe(el);
    const mo = new MutationObserver(() => updateRailFade());
    mo.observe(el, { childList: true, subtree: true });
    el.addEventListener("scroll", updateRailFade, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", updateRailFade);
    };
  }, [updateRailFade, chips.length, openSlot]);

  const slotsWithValues = new Set(chips.map((c) => c.slot));

  const toggleSlot = (slot: IntakeChipSlotId) => {
    if (openSlot === slot) {
      onCloseSlot();
      return;
    }
    onOpenSlot(slot);
  };

  const summaryChipElements =
    chips.length > 0
      ? chips.map((chip) => (
          <SemanticChip
            key={chip.id}
            epistemic={chip.epistemic}
            label={chip.label}
            onPress={chip.onPress ?? (() => toggleSlot(chip.slot))}
            pressOnPointerDown
            truncate
            animateIn
            removable={chip.removable ?? Boolean(chip.onRemove)}
            onRemove={chip.onRemove}
            className="shrink-0 max-w-[200px]"
          />
        ))
      : null;

  const panel = openSlot ? renderSlotContent(openSlot, onCloseSlot) : null;

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="relative w-full min-w-0">
        <div ref={railScrollRef} className={SCROLLER_ROW_CLASS}>
          {SLOTS.map(({ id, icon: Icon, title }) => {
            const isOpen = openSlot === id;
            const hasValue = slotsWithValues.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleSlot(id)}
                aria-label={title}
                title={title}
                style={{ width: RAIL_ICON_PX, minWidth: RAIL_ICON_PX }}
                className={cn(
                  "flex h-6 shrink-0 items-center justify-center overflow-hidden rounded-[8px]",
                  "transition-[background-color,box-shadow,color] duration-200 ease-out",
                  isOpen
                    ? "bg-transparent text-muted-foreground shadow-e1"
                    : cn(
                        "bg-transparent text-muted-foreground shadow-none",
                        "hover:shadow-inset"
                      )
                )}
              >
                <Icon className="h-[14px] w-[14px] shrink-0" />
              </button>
            );
          })}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-10 items-center justify-end pr-0.5 transition-opacity duration-200",
            railShowRightFade ? "opacity-100" : "opacity-0"
          )}
          style={RAIL_FADE_TEXTURE_STYLE}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-[#8EC9CE]",
              "drop-shadow-[0_0_6px_rgba(142,201,206,0.85)]",
              "animate-[chip-chevron-glow_2.4s_ease-in-out_infinite]"
            )}
            strokeWidth={2.25}
          />
        </div>
      </div>

      {panel && (
        <div className="!mt-0 rounded-[12px] bg-background/70 px-0.5 py-[3px]">
          <div className="min-w-0 border-b border-border/15 pb-px">
            <HorizontalOverflowRow className={SCROLLER_ROW_CLASS}>{panel.row2}</HorizontalOverflowRow>
          </div>
          <div className="min-w-0 space-y-1 pt-0">
            <HorizontalOverflowRow className={SCROLLER_ROW_CLASS}>{panel.row3}</HorizontalOverflowRow>
            {summaryChipElements && (
              <HorizontalOverflowRow
                className={cn(
                  SCROLLER_ROW_CLASS,
                  "border-t-2 border-dashed border-white/65 [border-image:none] pt-[9px] mt-1.5"
                )}
              >
                {summaryChipElements}
              </HorizontalOverflowRow>
            )}
          </div>
        </div>
      )}

      {!openSlot && summaryChipElements && (
        <HorizontalOverflowRow className={cn(SCROLLER_ROW_CLASS, "border-t border-border/20 pt-2")}>
          {summaryChipElements}
        </HorizontalOverflowRow>
      )}
    </div>
  );
}
