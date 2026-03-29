/**
 * IntakeChipRow — Exactly 3 rows under the composer when a section is open:
 * Row 1: Section icon rail (scroll + optional fade).
 * Row 2: Category actions (+ Person / inputs / quick dates) — single horizontal scroller.
 * Row 3: Suggestions for that section + summary (AI / fact) chips — one horizontal scroller.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { User, MapPin, Calendar, Box, AlertTriangle, Tag, Shield } from "lucide-react";
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

const PANEL_SCROLL_ROW = cn(
  "flex min-h-7 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden py-1 scrollbar-hz-teal"
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  const slotsWithValues = new Set(chips.map((c) => c.slot));

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
    el.addEventListener("scroll", updateFade, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateFade);
    };
  }, [updateFade, chips.length, openSlot]);

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
            className="shrink-0 max-w-[200px]"
          />
        ))
      : null;

  const panel = openSlot ? renderSlotContent(openSlot, onCloseSlot) : null;

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="relative w-full min-w-0">
        <div
          ref={scrollRef}
          className={cn(
            "flex min-h-7 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden py-1 scrollbar-hz-teal"
          )}
        >
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
                    ? "bg-card text-primary shadow-inset"
                    : cn(
                        "bg-background text-muted-foreground",
                        "shadow-[2px_2px_4px_0px_rgba(0,0,0,0.08),-1px_-1px_2px_0px_rgba(255,255,255,0.5),inset_1px_1px_1px_0px_rgba(255,255,255,0.4)]",
                        "hover:shadow-inset",
                        hasValue && "text-primary/90"
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
            "pointer-events-none absolute inset-y-0 right-0 z-[1] w-7 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
            showRightFade ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {panel && (
        <div className="!mt-0 rounded-[12px] bg-background/70 px-0.5 py-[3px]">
          <div className="min-w-0 border-b border-border/15 pb-px">
            <div className={PANEL_SCROLL_ROW}>{panel.row2}</div>
          </div>
          <div className="min-w-0 pt-2">
            <div className={PANEL_SCROLL_ROW}>
              {panel.row3}
              {summaryChipElements}
            </div>
          </div>
        </div>
      )}

      {!openSlot && summaryChipElements && (
        <div className={cn(PANEL_SCROLL_ROW, "border-t border-border/20 pt-2")}>{summaryChipElements}</div>
      )}
    </div>
  );
}
