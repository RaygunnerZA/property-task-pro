/**
 * WhenPanel - Task Context Resolver for timing
 * 
 * Design Constraints:
 * - Uses ContextResolver wrapper
 * - Chips below perforation = commitment
 * - Uses DashboardCalendar and TimeSelector for new UI
 */

import { useState, useMemo } from "react";
import { Calendar, Repeat, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RepeatRule } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ContextResolver } from "../ContextResolver";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { TimeSelector } from "@/components/dashboard/TimeSelector";

interface WhenPanelProps {
  dueDate: string;
  repeatRule?: RepeatRule;
  onDueDateChange: (date: string) => void;
  onRepeatRuleChange: (rule: RepeatRule | undefined) => void;
}

const quickDates = [
  { label: "TODAY", days: 0 },
  { label: "TOMORROW", days: 1 },
  { label: "THIS WEEK", days: 7 },
  { label: "NEXT WEEK", days: 14 },
];

function getWeekdayName(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = parseISO(dateStr.split("T")[0]);
    return format(date, "EEEE");
  } catch {
    return "";
  }
}

export function WhenPanel({ 
  dueDate, 
  repeatRule, 
  onDueDateChange, 
  onRepeatRuleChange 
}: WhenPanelProps) {
  const [enableRepeat, setEnableRepeat] = useState(!!repeatRule);
  
  // Parse date and time from dueDate
  const selectedDate = useMemo(() => {
    if (!dueDate) return new Date();
    try {
      const dateStr = dueDate.split('T')[0];
      return parseISO(dateStr);
    } catch {
      return new Date();
    }
  }, [dueDate]);

  const dueTime = dueDate.includes('T') ? dueDate.split('T')[1]?.slice(0, 5) : '09:00';
  const [hour, minute] = useMemo(() => {
    if (dueTime) {
      const [h, m] = dueTime.split(':').map(Number);
      return [h || 9, m || 0];
    }
    return [9, 0];
  }, [dueTime]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onDueDateChange(`${dateStr}T${timeStr}`);
  };

  const handleTimeChange = (newHour: number, newMinute: number) => {
    const dateStr = dueDate.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
    const timeStr = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
    onDueDateChange(`${dateStr}T${timeStr}`);
  };

  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onDueDateChange(`${dateStr}T${timeStr}`);
  };

  const handleRepeatToggle = (enabled: boolean) => {
    setEnableRepeat(enabled);
    if (!enabled) {
      onRepeatRuleChange(undefined);
    } else {
      onRepeatRuleChange({ type: "weekly", interval: 1 });
    }
  };

  const handleRepeatTypeChange = (type: "daily" | "weekly" | "monthly") => {
    onRepeatRuleChange({ ...repeatRule, type, interval: repeatRule?.interval || 1 });
  };

  const handleRepeatIntervalChange = (interval: number) => {
    if (repeatRule) {
      onRepeatRuleChange({ ...repeatRule, interval });
    }
  };

  return (
    <div className="space-y-6">
      <ContextResolver
        title="Set due date and time."
        helperText="When?"
      >
        {/* Quick Date Selection */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickDates.map(({ label, days }) => {
            const isActive = dueDate && (() => {
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() + days);
              return dueDate.split("T")[0] === targetDate.toISOString().split("T")[0];
            })();
            return (
              <button
                key={label}
                type="button"
                onClick={() => setQuickDate(days)}
                className={cn(
                  "px-3 py-1.5 rounded-[5px] font-mono text-xs uppercase tracking-wide transition-all",
                  "select-none cursor-pointer",
                  isActive
                    ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                    : "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Dashboard Calendar */}
        <div className="space-y-3">
          <DashboardCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            tasks={[]}
            className="w-full"
          />
        </div>

        {/* Time Selector */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Time
          </label>
          <TimeSelector
            hour={hour}
            minute={minute}
            onTimeChange={handleTimeChange}
          />
        </div>
      </ContextResolver>

      {/* Repeat Settings */}
      <ContextResolver
        title="Set up recurring task (optional)."
        helperText="Repeat"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Repeat Task</span>
            <Switch
              checked={enableRepeat}
              onCheckedChange={handleRepeatToggle}
            />
          </div>

          {enableRepeat && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-[5px] bg-muted/50 shadow-engraved">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Frequency</label>
                <Select 
                  value={repeatRule?.type || "weekly"} 
                  onValueChange={(val) => handleRepeatTypeChange(val as "daily" | "weekly" | "monthly")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Every</label>
                <Select 
                  value={String(repeatRule?.interval || 1)} 
                  onValueChange={(val) => handleRepeatIntervalChange(parseInt(val))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {repeatRule?.type === "daily" ? "day" : repeatRule?.type === "weekly" ? "week" : "month"}{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </ContextResolver>
    </div>
  );
}

