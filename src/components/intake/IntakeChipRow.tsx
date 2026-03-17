/**
 * IntakeChipRow — Wrapped context chips for IntakeModal.
 * Renders fact/proposal chips first, followed by any unused section icon chips.
 */

import { useEffect, useRef, useState } from "react";
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

const HOLD_MS = 1800;
const COLLAPSED_SIZE_PX = 24;

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
  renderSlotContent: (slot: IntakeChipSlotId, onClose: () => void) => React.ReactNode;
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
  const displayedSlots = new Set(chips.map((chip) => chip.slot));
  const unusedSlots = SLOTS.filter((slot) => !displayedSlots.has(slot.id));
  const [hoveredId, setHoveredId] = useState<IntakeChipSlotId | null>(null);
  const [delayedCloseId, setDelayedCloseId] = useState<IntakeChipSlotId | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const toggleSlot = (slot: IntakeChipSlotId) => {
    if (openSlot === slot) {
      onCloseSlot();
      return;
    }
    onOpenSlot(slot);
  };

  const handleMouseEnter = (slot: IntakeChipSlotId) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setDelayedCloseId(null);
    setHoveredId(slot);
  };

  const handleMouseLeave = (slot: IntakeChipSlotId) => {
    setHoveredId((current) => (current === slot ? null : current));
    holdTimerRef.current = setTimeout(() => {
      setDelayedCloseId((current) => (current === slot ? null : current));
      holdTimerRef.current = null;
    }, HOLD_MS);
    setDelayedCloseId(slot);
  };

  const isExpanded = (slot: IntakeChipSlotId) => hoveredId === slot || delayedCloseId === slot || openSlot === slot;

  const getExpandedWidthPx = (label: string) => {
    const estimated = 38 + label.length * 5.8;
    return Math.max(88, Math.min(156, Math.round(estimated)));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-start gap-2 min-h-6 py-1">
        {chips.map((chip) => (
          <SemanticChip
            key={chip.id}
            epistemic={chip.epistemic}
            label={chip.label}
            onPress={chip.onPress ?? (() => toggleSlot(chip.slot))}
          />
        ))}

        {unusedSlots.map(({ id, icon: Icon, title }) => {
          const isOpen = openSlot === id;
          const expanded = isExpanded(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleSlot(id)}
              onMouseEnter={() => handleMouseEnter(id)}
              onMouseLeave={() => handleMouseLeave(id)}
              aria-label={title}
              title={title}
              style={{ width: expanded ? `${getExpandedWidthPx(title)}px` : `${COLLAPSED_SIZE_PX}px` }}
              className={cn(
                "flex h-6 shrink-0 items-center gap-1.5 overflow-hidden rounded-[8px]",
                "transition-[width,padding,background-color,box-shadow] duration-[1020ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                expanded ? "pl-[5px] pr-[6px]" : "justify-center px-[5px]",
                isOpen
                  ? "bg-card shadow-inset"
                  : "bg-background text-muted-foreground shadow-[2px_2px_4px_0px_rgba(0,0,0,0.08),-1px_-1px_2px_0px_rgba(255,255,255,0.5),inset_1px_1px_1px_0px_rgba(255,255,255,0.4)] hover:shadow-inset"
              )}
            >
              <Icon className={cn("h-[14px] w-[14px] shrink-0", isOpen ? "text-primary" : "text-muted-foreground")} />
              <span
                className={cn(
                  "text-[11px] font-mono uppercase tracking-wide whitespace-nowrap overflow-hidden",
                  "transition-[opacity,clip-path,max-width] duration-[1020ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                  expanded
                    ? "opacity-100 [clip-path:inset(0_0_0_0)] max-w-[120px]"
                    : "opacity-0 [clip-path:inset(0_100%_0_0)] max-w-0"
                )}
              >
                {title}
              </span>
            </button>
          );
        })}
      </div>

      {openSlot && (
        <div className="rounded-[12px] bg-background/70 py-2.5 px-0">
          {renderSlotContent(openSlot, onCloseSlot)}
        </div>
      )}
    </div>
  );
}
