/**
 * MiniCalendarDayTile - Filla Design System v3.3
 * Individual day cell with task markers and compliance flags
 */

import React from "react";
import { cn } from "@/lib/utils";

// ===== DATA TYPES =====
export interface TaskEvent {
  priority: "low" | "normal" | "high";
}

export interface ComplianceEvent {
  severity: "low" | "medium" | "high";
}

export interface DayData {
  date: string;
  tasks: TaskEvent[];
  compliance: ComplianceEvent[];
}

interface MiniCalendarDayTileProps {
  day: number;
  date: Date;
  isSelected?: boolean;
  isToday?: boolean;
  isOutOfMonth?: boolean;
  tasks?: TaskEvent[];
  compliance?: ComplianceEvent[];
  onClick?: () => void;
  className?: string;
}

// ===== MARKER UTILITIES =====

/**
 * Group items by their priority/severity and return counts
 */
function groupByPriority<T extends { priority?: string; severity?: string }>(
  items: T[],
  key: "priority" | "severity"
): Map<string, number> {
  const groups = new Map<string, number>();
  for (const item of items) {
    const value = key === "priority" 
      ? (item as { priority: string }).priority 
      : (item as { severity: string }).severity;
    groups.set(value, (groups.get(value) || 0) + 1);
  }
  return groups;
}

// ===== TASK MARKERS (Bottom Left) =====
const TaskMarkers: React.FC<{ tasks: TaskEvent[] }> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  const groups = groupByPriority(tasks, "priority");
  const order: ("low" | "normal" | "high")[] = ["low", "normal", "high"];
  
  // Color mapping for task priorities
  const colors: Record<string, string> = {
    low: "bg-white/80",
    normal: "bg-primary",
    high: "bg-accent",
  };

  const markers: React.ReactNode[] = [];
  
  for (const priority of order) {
    const count = groups.get(priority) || 0;
    if (count === 0) continue;

    // Calculate height based on count (capsule stretches for multiple)
    const baseSize = "w-[6px]";
    const height = count >= 2 
      ? `h-[${Math.min(6 + (count - 1) * 4, 16)}px]` 
      : "h-[6px]";
    
    markers.push(
      <div
        key={priority}
        className={cn(
          baseSize,
          colors[priority],
          "rounded-full transition-all duration-150",
          // Dynamic height based on count
          count >= 2 ? "h-3" : "h-1.5",
        )}
        style={{
          height: count >= 2 ? `${Math.min(6 + (count - 1) * 4, 16)}px` : "6px",
        }}
      />
    );
  }

  return (
    <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-0.5 items-center">
      {markers}
    </div>
  );
};

// ===== COMPLIANCE FLAGS (Top Right) =====
const ComplianceFlags: React.FC<{ compliance: ComplianceEvent[] }> = ({ compliance }) => {
  if (compliance.length === 0) return null;

  const groups = groupByPriority(compliance, "severity");
  const order: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
  
  // Color mapping for compliance severity
  const colors: Record<string, string> = {
    low: "bg-white/80",
    medium: "bg-primary",
    high: "bg-accent",
  };

  const flags: React.ReactNode[] = [];
  
  for (const severity of order) {
    const count = groups.get(severity) || 0;
    if (count === 0) continue;

    flags.push(
      <FlagMarker
        key={severity}
        color={colors[severity]}
        count={count}
      />
    );
  }

  return (
    <div className="absolute top-1 right-1 flex flex-col gap-0.5 items-end">
      {flags}
    </div>
  );
};

// Individual flag/bookmark shape
const FlagMarker: React.FC<{ color: string; count: number }> = ({ color, count }) => {
  // Height stretches based on count
  const baseHeight = 10;
  const height = count >= 2 ? Math.min(baseHeight + (count - 1) * 4, 20) : baseHeight;
  
  return (
    <svg
      width="8"
      height={height}
      viewBox={`0 0 8 ${height}`}
      className="transition-all duration-150"
    >
      <path
        d={`M0 2 Q0 0 2 0 L6 0 Q8 0 8 2 L8 ${height - 3} L4 ${height - 6} L0 ${height - 3} Z`}
        className={color}
        fill="currentColor"
      />
    </svg>
  );
};

// ===== MAIN COMPONENT =====
export const MiniCalendarDayTile: React.FC<MiniCalendarDayTileProps> = ({
  day,
  date,
  isSelected = false,
  isToday = false,
  isOutOfMonth = false,
  tasks = [],
  compliance = [],
  onClick,
  className,
}) => {
  const hasEvents = tasks.length > 0 || compliance.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isOutOfMonth}
      className={cn(
        // Base styles
        "relative aspect-square flex items-center justify-center",
        "rounded-[12px] font-mono text-sm font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        
        // Paper texture background (simulated with gradient)
        !isOutOfMonth && "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
        
        // Selected state - neomorphic pressed effect
        isSelected && [
          "bg-[#F8F7F4]",
          "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.06)]",
        ],
        
        // Hover state
        !isSelected && !isOutOfMonth && [
          "shadow-e1 hover:shadow-e2 hover:-translate-y-0.5",
        ],
        
        // Events present - show card background
        hasEvents && !isSelected && "shadow-e1",
        
        // Out of month state
        isOutOfMonth && "opacity-40 cursor-not-allowed bg-transparent",
        
        className
      )}
    >
      {/* Day Number */}
      <span
        className={cn(
          "font-mono text-primary-deep",
          isOutOfMonth && "text-muted-foreground",
        )}
      >
        {day}
      </span>

      {/* Today Indicator - tiny white dot bottom-left */}
      {isToday && !isSelected && (
        <div className="absolute bottom-1 left-1 w-1 h-1 rounded-full bg-white shadow-sm" />
      )}

      {/* Task Markers - bottom left */}
      {!isOutOfMonth && <TaskMarkers tasks={tasks} />}

      {/* Compliance Flags - top right */}
      {!isOutOfMonth && <ComplianceFlags compliance={compliance} />}
    </button>
  );
};
