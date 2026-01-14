import React from "react";
import { ScheduleItemBase } from "@/types/schedule";

interface ScheduleItemCardProps {
  item: ScheduleItemBase;
  onPress?: (item: ScheduleItemBase) => void;
}

/**
 * ScheduleItemCard
 * - Unified visual card for Tasks + Reminders
 * - Appears in List, Week View, and Day Drawer
 * - Tactile paper surface with neomorphic accents
 */

export const ScheduleItemCard: React.FC<ScheduleItemCardProps> = ({
  item,
  onPress,
}) => {
  const isTask = item.kind === "task";
  const isReminder = item.kind === "signal";

  // Accent bar: determined by urgency or item kind
  const accentColor = item.priority
    ? priorityToColor(item.priority)
    : isTask
    ? "bg-primary/70"
    : "bg-amber-500/60";

  return (
    <button
      type="button"
      onClick={() => onPress?.(item)}
      className="w-full flex items-start gap-3 px-3 py-3 rounded-[8px] text-left bg-card shadow-e2 transition-all active:shadow-engraved"
    >
      {/* Accent Bar */}
      <div className={`w-1.5 h-12 rounded-full ${accentColor}`} />

      {/* CONTENT */}
      <div className="flex-1 min-w-0">
        {/* Top Row: Title + Type chip */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold truncate">{item.title}</span>

          <span
            className={`text-[10px] px-2 py-[2px] rounded-full font-medium shrink-0 ${
              isTask
                ? "bg-primary/10 text-primary"
                : "bg-amber-500/10 text-amber-700"
            }`}
          >
            {isTask ? "Task" : "Reminder"}
          </span>
        </div>

        {/* Time + Status */}
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
          <span>{item.time ?? "All day"}</span>
          {item.status && <span>• {formatStatus(item.status)}</span>}
        </div>

        {/* Property + Space */}
        {(item.propertyName || item.spaceName) && (
          <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap gap-2">
            {item.propertyName && <span>{item.propertyName}</span>}
            {item.spaceName && <span>• {item.spaceName}</span>}
          </div>
        )}
      </div>
    </button>
  );
};

/* --------------------------------------------
   Helpers
--------------------------------------------- */

function priorityToColor(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-500/70";
    case "high":
      return "bg-orange-500/70";
    case "medium":
      return "bg-yellow-500/70";
    case "low":
      return "bg-slate-400/60";
    default:
      return "bg-primary/70";
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}
