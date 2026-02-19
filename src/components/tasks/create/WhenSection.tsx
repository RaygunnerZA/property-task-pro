/**
 * WhenSection - Create Task "When" row with inline quick chips and milestone editing.
 *
 * Contract:
 * - Single-line row (no wrapping), horizontal scroll on overflow.
 * - Date/time selector opens ONLY when editing due date (Custom / clicking due chip) or milestones.
 * - Adding/editing milestone dims other date chips 35% while editing.
 * - New milestone starts at TODAY; scrolling applies live to the active milestone draft.
 * - Clicking outside the selector saves the milestone draft and closes the selector; all chips return to 100% opacity.
 * - Clicking existing due date or milestone edits it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Repeat, Waypoints } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { SemanticChip } from "@/components/chips/semantic";
import type { RepeatRule } from "@/types/database";
import { WhenPanel } from "@/components/tasks/create/panels/WhenPanel";

const QUICK_DATES = [
  { id: "today", label: "Today", days: 0 },
  { id: "tom", label: "Tom", days: 1 },
  { id: "+7d", label: "+7D", days: 7 },
  { id: "+14d", label: "+14D", days: 14 },
];

const REPEAT_OPTIONS = [
  { id: "daily", label: "Daily", type: "daily" as const },
  { id: "weekly", label: "Weekly", type: "weekly" as const },
  { id: "monthly", label: "Monthly", type: "monthly" as const },
  { id: "custom", label: "Custom", type: "weekly" as const },
];

export type MilestoneItem = { id: string; dateTime: string; label?: string };

interface WhenSectionProps {
  isActive: boolean;
  onActivate: () => void;
  onDeactivate?: () => void;
  dueDate: string;
  repeatRule?: RepeatRule;
  onDueDateChange: (date: string) => void;
  onRepeatRuleChange: (rule: RepeatRule | undefined) => void;
  hasUnresolved?: boolean;
  /** When provided, milestone state is owned by the parent (lifted state). */
  milestones?: MilestoneItem[];
  onMilestonesChange?: (milestones: MilestoneItem[]) => void;
}

export function WhenSection({
  isActive,
  onActivate,
  onDeactivate,
  dueDate,
  repeatRule,
  onDueDateChange,
  onRepeatRuleChange,
  hasUnresolved = false,
  milestones: externalMilestones,
  onMilestonesChange,
}: WhenSectionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);

  const [_internalMs, _setInternalMs] = useState<MilestoneItem[]>([]);
  const milestones = externalMilestones ?? _internalMs;
  const msRef = useRef(milestones);
  msRef.current = milestones;

  const setMilestones = useCallback(
    (action: MilestoneItem[] | ((prev: MilestoneItem[]) => MilestoneItem[])) => {
      const resolved = typeof action === "function" ? action(msRef.current) : action;
      if (onMilestonesChange) {
        onMilestonesChange(resolved);
      } else {
        _setInternalMs(resolved);
      }
    },
    [onMilestonesChange],
  );

  const [draftMilestone, setDraftMilestone] = useState<MilestoneItem | null>(null);
  const [editing, setEditing] = useState<{ kind: "due" } | { kind: "milestone"; id: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());
  const hasDate = !!dueDate;

  const timePartForDefault = useMemo(() => {
    if (dueDate.includes("T")) return dueDate.split("T")[1] || "09:00";
    return "09:00";
  }, [dueDate]);

  const formatDueLabel = () => {
    if (!dueDate) return null;
    const d = dueDate.split("T")[0];
    const dateObj = d ? new Date(d + "T00:00:00") : new Date();
    const timePart = dueDate.includes("T") ? dueDate.split("T")[1]?.slice(0, 5) : null;
    if (isSameDay(dateObj, today)) return "TODAY";
    if (isSameDay(dateObj, addDays(today, 1))) return "TOMORROW";
    const dateStr = format(dateObj, "EEE d MMM");
    return timePart ? `${dateStr} | ${timePart}` : dateStr.toUpperCase();
  };

  const formatDateTimeLabel = (dateTime: string, label?: string) => {
    if (!dateTime) return label || "";
    const d = dateTime.split("T")[0];
    const dateObj = d ? new Date(d + "T00:00:00") : new Date();
    const timePart = dateTime.includes("T") ? dateTime.split("T")[1]?.slice(0, 5) : null;
    const dateStr = format(dateObj, "EEE d MMM").toUpperCase();
    const timePartStr = timePart ? `${dateStr} | ${timePart}` : dateStr;
    return label ? `${label} | ${timePartStr}` : timePartStr;
  };

  const handleQuickDate = (days: number) => {
    const d = addDays(today, days);
    const timePart = timePartForDefault;
    onDueDateChange(`${format(d, "yyyy-MM-dd")}T${timePart}`);
  };

  const maybeCommitDraft = () => {
    if (!draftMilestone) return;
    setMilestones((prev) => [...prev, draftMilestone]);
    setDraftMilestone(null);
  };

  const closeEditor = () => {
    maybeCommitDraft();
    setEditing(null);
    setShowRepeatOptions(false);
    onDeactivate?.();
  };

  const startEditDue = (forceTodayIfEmpty: boolean) => {
    maybeCommitDraft();
    onActivate();
    if (forceTodayIfEmpty && !dueDate) {
      onDueDateChange(`${format(today, "yyyy-MM-dd")}T${timePartForDefault}`);
    }
    setEditing({ kind: "due" });
    setShowRepeatOptions(false);
  };

  const handleRepeatClick = () => {
    setShowRepeatOptions((prev) => !prev);
  };

  const startAddMilestone = () => {
    maybeCommitDraft();
    onActivate();
    setShowRepeatOptions(false);
    const id = `milestone-${Date.now()}`;
    const initial = `${format(today, "yyyy-MM-dd")}T${timePartForDefault}`;
    setDraftMilestone({ id, dateTime: initial, label: "" });
    setEditing({ kind: "milestone", id });
  };

  const handleRepeatOption = (type: "daily" | "weekly" | "monthly") => {
    onRepeatRuleChange({ type, interval: 1 });
    setShowRepeatOptions(false);
  };

  const dateFactLabel = formatDueLabel();
  const hideRepeat = milestones.length > 0 || !!draftMilestone;

  const editingValue = useMemo(() => {
    if (!editing) return "";
    if (editing.kind === "due") return dueDate;
    if (draftMilestone && draftMilestone.id === editing.id) return draftMilestone.dateTime;
    return milestones.find((m) => m.id === editing.id)?.dateTime || "";
  }, [editing, dueDate, draftMilestone, milestones]);

  const handlePanelDateChange = (next: string) => {
    if (!editing) return;
    if (editing.kind === "due") {
      onDueDateChange(next);
      return;
    }
    if (draftMilestone && draftMilestone.id === editing.id) {
      setDraftMilestone({ ...draftMilestone, dateTime: next });
      return;
    }
    setMilestones((prev) => prev.map((m) => (m.id === editing.id ? { ...m, dateTime: next } : m)));
  };

  const handleMilestoneLabelChange = (label: string) => {
    if (!editing || editing.kind !== "milestone") return;
    if (draftMilestone && draftMilestone.id === editing.id) {
      setDraftMilestone({ ...draftMilestone, label: label.trim() || undefined });
      return;
    }
    setMilestones((prev) => prev.map((m) => (m.id === editing.id ? { ...m, label: label.trim() || undefined } : m)));
  };

  const editingMilestoneLabel = useMemo(() => {
    if (!editing || editing.kind !== "milestone") return "";
    if (draftMilestone && draftMilestone.id === editing.id) return draftMilestone.label ?? "";
    return milestones.find((m) => m.id === editing.id)?.label ?? "";
  }, [editing, draftMilestone, milestones]);

  const isDimmed = (kind: "due" | "milestone", id?: string) => {
    if (!editing) return false;
    if (editing.kind === "due") return kind !== "due";
    // milestone editing (draft or existing)
    if (kind === "milestone" && id && id === editing.id) return false;
    return true;
  };

  // Click outside / row click closes selector and commits draft
  useEffect(() => {
    if (!editing) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (containerRef.current && containerRef.current.contains(t)) {
        // If the click was on an explicit action chip, allow it (it will switch editing target).
        if (t.closest("[data-when-action='true']")) return;
        closeEditor();
        return;
      }
      // Outside section
      closeEditor();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draftMilestone, dueDate, timePartForDefault]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-col rounded-[8px] transition-all duration-200",
        !isActive && "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2 h-[36px] min-w-0">
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-[8px] bg-background">
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>

        <div
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap pr-[6px]">
          {/* Fact chips: date, recurrence */}
          {dateFactLabel && (
            <span data-when-action="true" className="shrink-0">
              <SemanticChip
                epistemic="fact"
                label={dateFactLabel}
                truncate={false}
                onPress={() => startEditDue(false)}
                removable
                onRemove={() => {
                  onDueDateChange("");
                  onRepeatRuleChange(undefined);
                  setMilestones([]);
                  setDraftMilestone(null);
                  setEditing(null);
                  setShowRepeatOptions(false);
                  onDeactivate?.();
                }}
                className={cn("shrink-0 max-w-none", isDimmed("due") && "opacity-65")}
              />
            </span>
          )}
          {repeatRule && (
            <SemanticChip
              epistemic="fact"
              label={repeatRule.type.toUpperCase()}
              icon={<Repeat className="h-3 w-3" />}
              truncate
              onPress={() => setShowRepeatOptions((prev) => !prev)}
              pressOnPointerDown
              removable
              onRemove={() => onRepeatRuleChange(undefined)}
              className="shrink-0"
            />
          )}
          {milestones.map((m) => (
            <span key={m.id} data-when-action="true" className="shrink-0">
              <SemanticChip
                epistemic="fact"
                label={formatDateTimeLabel(m.dateTime, m.label)}
                icon={<Waypoints className="h-3 w-3" />}
                truncate={false}
                onPress={() => {
                  maybeCommitDraft();
                  onActivate();
                  setEditing({ kind: "milestone", id: m.id });
                }}
                removable
                onRemove={() => {
                  setMilestones((prev) => prev.filter((x) => x.id !== m.id));
                  if (editing?.kind === "milestone" && editing.id === m.id) closeEditor();
                }}
                className={cn("shrink-0 max-w-none", isDimmed("milestone", m.id) && "opacity-65")}
              />
            </span>
          ))}

          {draftMilestone && (
            <span data-when-action="true" className="shrink-0">
              <SemanticChip
                epistemic="fact"
                label={formatDateTimeLabel(draftMilestone.dateTime, draftMilestone.label)}
                icon={<Waypoints className="h-3 w-3" />}
                truncate={false}
                onPress={() => {
                  onActivate();
                  setEditing({ kind: "milestone", id: draftMilestone.id });
                }}
                className="shrink-0 max-w-none"
              />
            </span>
          )}

          {/* Hover chips: quick dates when no date, or Repeat/Milestone when date set */}
          {isHovered && (
            <>
              {!hasDate ? (
                <>
                  {QUICK_DATES.map(({ id, label, days }) => (
                    <SemanticChip
                      key={id}
                      epistemic="proposal"
                      label={label}
                      truncate
                      onPress={() => handleQuickDate(days)}
                      className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                    />
                  ))}
                  <SemanticChip
                    epistemic="proposal"
                    label="+Custom"
                    truncate
                    onPress={() => startEditDue(true)}
                    pressOnPointerDown
                    className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                  />
                </>
              ) : (
                <>
                  {!hideRepeat && (
                    <>
                      {!repeatRule && (
                        <SemanticChip
                          epistemic="proposal"
                          label="Repeat"
                          icon={<Repeat className="h-3 w-3" />}
                          truncate
                          onPress={handleRepeatClick}
                          pressOnPointerDown
                          className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                        />
                      )}
                      {showRepeatOptions &&
                        REPEAT_OPTIONS.map(({ id, label, type }) => (
                          <SemanticChip
                            key={id}
                            epistemic="proposal"
                            label={label}
                            truncate
                            onPress={() => handleRepeatOption(type)}
                            className="shrink-0"
                          />
                        ))}
                    </>
                  )}
                  <SemanticChip
                    epistemic="proposal"
                    label="+Milestone"
                    icon={<Waypoints className="h-3 w-3" />}
                    truncate
                    onPress={startAddMilestone}
                    pressOnPointerDown
                    className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                  />
                </>
              )}
            </>
          )}
          </div>
        </div>

        {hasUnresolved && !isActive && (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 border border-background" />
        )}
      </div>

      {/* Date/time selector (only when editing due date / milestone) */}
      {editing && (
        <div ref={panelRef} className="pl-[22px] pt-2 pb-2 space-y-2">
          {editing.kind === "milestone" && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono uppercase text-muted-foreground shrink-0">Name</label>
              <input
                type="text"
                placeholder="e.g. Alert, Launch"
                value={editingMilestoneLabel}
                onChange={(e) => handleMilestoneLabelChange(e.target.value)}
                className="h-7 w-24 px-2 rounded-[6px] text-xs font-mono bg-background shadow-e1 border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <WhenPanel
            dueDate={editingValue}
            repeatRule={repeatRule}
            onDueDateChange={handlePanelDateChange}
            onRepeatRuleChange={onRepeatRuleChange}
            showQuickDates={false}
          />
        </div>
      )}
    </div>
  );
}
