/**
 * IntakeChipRow — Compact horizontal context chip row for IntakeModal.
 * Sections: Assign, Location, Date, Asset, Priority, Tag, Compliance.
 * Default: icon-only neumorphic ghost chip. On hover: smooth expand right to show title; holds 1s after inactive then closes.
 * When value/suggestion exists: chip stays expanded to show it (e.g. "Invite Frank", "Thursday").
 */

import { useState, useRef, useEffect } from "react";
import { User, MapPin, Calendar, Box, AlertTriangle, Tag, Shield } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

const HOLD_MS = 1000;

export interface IntakeChipRowValues {
  who?: string;
  where?: string;
  when?: string;
  asset?: string;
  priority?: string;
  category?: string;
  compliance?: string;
}

export interface IntakeChipRowProps {
  values: IntakeChipRowValues;
  onOpenSlot: (slot: IntakeChipSlotId) => void;
  openSlot: IntakeChipSlotId | null;
  onCloseSlot: () => void;
  renderSlotContent: (slot: IntakeChipSlotId, onClose: () => void) => React.ReactNode;
  className?: string;
}

function getDisplayLabel(id: IntakeChipSlotId, value: string | undefined, title: string): string {
  if (value) return value;
  return title;
}

export function IntakeChipRow({
  values,
  onOpenSlot,
  openSlot,
  onCloseSlot,
  renderSlotContent,
  className,
}: IntakeChipRowProps) {
  const [hoveredId, setHoveredId] = useState<IntakeChipSlotId | null>(null);
  const [delayedCloseId, setDelayedCloseId] = useState<IntakeChipSlotId | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getValue = (id: IntakeChipSlotId) => values[id === "category" ? "category" : id] || undefined;

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const handleMouseEnter = (id: IntakeChipSlotId) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setDelayedCloseId(null);
    setHoveredId(id);
  };

  const handleMouseLeave = (id: IntakeChipSlotId) => {
    setHoveredId(null);
    if (getValue(id)) return;
    holdTimerRef.current = setTimeout(() => {
      setDelayedCloseId(null);
      holdTimerRef.current = null;
    }, HOLD_MS);
    setDelayedCloseId(id);
  };

  const isExpanded = (id: IntakeChipSlotId) => {
    const value = getValue(id);
    if (value) return true;
    if (hoveredId === id) return true;
    if (delayedCloseId === id) return true;
    return false;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto no-scrollbar min-h-9 px-0 py-1",
        className
      )}
    >
      {SLOTS.map(({ id, icon: Icon, title }) => {
        const value = getValue(id);
        const isOpen = openSlot === id;
        const expanded = isExpanded(id);
        const displayText = getDisplayLabel(id, value, title);
        const label = value && id === "who" ? `Invite ${value}` : displayText;

        return (
          <Popover
            key={id}
            open={isOpen}
            onOpenChange={(open) => {
              if (!open) onCloseSlot();
              else onOpenSlot(id);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                onMouseEnter={() => handleMouseEnter(id)}
                onMouseLeave={() => handleMouseLeave(id)}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 rounded-[10px] py-1.5 overflow-hidden transition-[max-width] duration-300 ease-out",
                  "shadow-[2px_2px_4px_0px_rgba(0,0,0,0.08),-1px_-1px_2px_0px_rgba(255,255,255,0.5),inset_1px_1px_1px_0px_rgba(255,255,255,0.4)]",
                  value
                    ? "bg-primary/15 text-foreground border border-border/50 max-w-[160px]"
                    : "bg-muted/40 text-muted-foreground border border-transparent hover:border-border/40",
                  expanded ? "max-w-[160px] pl-2 pr-2" : "max-w-[36px] pl-1.5 pr-1.5"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap truncate max-w-[120px]",
                    !expanded && "opacity-0 w-0 overflow-hidden"
                  )}
                >
                  {expanded ? label : title}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2 rounded-lg shadow-e1">
              {renderSlotContent(id, onCloseSlot)}
            </PopoverContent>
          </Popover>
        );
      })}
      <span className="text-muted-foreground text-xs shrink-0 px-1">+ Add</span>
    </div>
  );
}
