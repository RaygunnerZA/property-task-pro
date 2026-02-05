/**
 * WhenPanel - Task Context Resolver for timing
 * 
 * Design Constraints:
 * - Compact two-column layout: horizontal date strip + time selector
 * - Does not increase modal width
 * - Quick date buttons above the selectors
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { Calendar, Repeat, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RepeatRule } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, parseISO, addDays, startOfDay, isSameDay } from "date-fns";
import { ContextResolver } from "../ContextResolver";

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

const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

export function WhenPanel({ 
  dueDate, 
  repeatRule, 
  onDueDateChange, 
  onRepeatRuleChange 
}: WhenPanelProps) {
  const [enableRepeat, setEnableRepeat] = useState(!!repeatRule);
  const dateScrollRef = useRef<HTMLDivElement>(null);
  
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
  
  // Convert 24h to 12h format
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const isPM = hour >= 12;

  // Generate dates for the horizontal strip (2 weeks centered on today)
  const dateOptions = useMemo(() => {
    const today = startOfDay(new Date());
    const dates: Date[] = [];
    for (let i = -3; i <= 14; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onDueDateChange(`${dateStr}T${timeStr}`);
  };

  const handleHourChange = (newHour12: number) => {
    const newHour24 = isPM ? (newHour12 === 12 ? 12 : newHour12 + 12) : (newHour12 === 12 ? 0 : newHour12);
    const dateStr = dueDate.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
    const timeStr = `${newHour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onDueDateChange(`${dateStr}T${timeStr}`);
  };

  const handleMinuteChange = (newMinute: number) => {
    const dateStr = dueDate.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
    onDueDateChange(`${dateStr}T${timeStr}`);
  };

  const handleAmPmToggle = () => {
    const newHour = isPM ? (hour === 12 ? 0 : hour - 12) : (hour === 0 ? 12 : hour + 12);
    const dateStr = dueDate.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
    const timeStr = `${newHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
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

  // Scroll to selected date on mount
  useEffect(() => {
    if (dateScrollRef.current) {
      const selectedIndex = dateOptions.findIndex(d => isSameDay(d, selectedDate));
      if (selectedIndex >= 0) {
        const itemWidth = 48; // approximate width of each date item
        const scrollLeft = Math.max(0, (selectedIndex * itemWidth) - (dateScrollRef.current.clientWidth / 2) + (itemWidth / 2));
        dateScrollRef.current.scrollLeft = scrollLeft;
      }
    }
  }, [selectedDate, dateOptions]);

  // Get the month/year to display based on selected date
  const displayMonth = months[selectedDate.getMonth()];
  const displayYear = selectedDate.getFullYear();

  return (
    <div className="space-y-4">
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
                  "px-3 py-1.5 rounded-[8px] font-mono text-xs uppercase tracking-wide transition-all",
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

        {/* Two-column layout: Date Strip + Time Selector */}
        <div className="flex gap-4">
          {/* Left Column: Horizontal Date Strip */}
          <div className="flex-1 min-w-0">
            {/* Month/Year Header */}
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-xl font-semibold text-foreground">{displayMonth}</span>
              <span className="text-sm text-primary font-semibold">{displayYear.toString().slice(2)}<br/>{displayYear.toString().slice(0, 2)}</span>
            </div>
            
            {/* Horizontal Scrolling Date Strip */}
            <div 
              ref={dateScrollRef}
              className="overflow-x-auto no-scrollbar pb-1"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div className="flex gap-1 min-w-max">
                {dateOptions.map((date, idx) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, new Date());
                  const dayName = format(date, 'EEE').toUpperCase();
                  const dayNum = date.getDate();
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDateSelect(date)}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[44px] py-2 px-1 rounded-[12px] transition-all duration-200",
                        "select-none cursor-pointer",
                        isSelected
                          ? "bg-[rgba(233,230,226,1)] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                          : "bg-transparent hover:bg-muted/30",
                        isToday && !isSelected && "bg-primary/10"
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-mono uppercase tracking-wide",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {dayName}
                      </span>
                      <span className={cn(
                        "text-lg font-semibold",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {dayNum}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Time Selector */}
          <div className="flex-shrink-0">
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-xl font-semibold text-foreground">Time</span>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Hour */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleHourChange(hour12 === 12 ? 1 : hour12 + 1)}
                  className="text-muted-foreground/50 hover:text-muted-foreground text-xs"
                >
                  ▲
                </button>
                <div className={cn(
                  "w-[44px] h-[44px] flex items-center justify-center rounded-[12px]",
                  "bg-[rgba(233,230,226,1)] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                )}>
                  <span className="text-lg font-mono font-semibold text-foreground">
                    {hour12.toString().padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleHourChange(hour12 === 1 ? 12 : hour12 - 1)}
                  className="text-muted-foreground/50 hover:text-muted-foreground text-xs"
                >
                  ▼
                </button>
              </div>

              <span className="text-lg font-semibold text-muted-foreground">:</span>

              {/* Minute */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleMinuteChange(minute === 45 ? 0 : minute + 15)}
                  className="text-muted-foreground/50 hover:text-muted-foreground text-xs"
                >
                  ▲
                </button>
                <div className={cn(
                  "w-[44px] h-[44px] flex items-center justify-center rounded-[12px]",
                  "bg-[rgba(233,230,226,1)] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                )}>
                  <span className="text-lg font-mono font-semibold text-foreground">
                    {minute.toString().padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleMinuteChange(minute === 0 ? 45 : minute - 15)}
                  className="text-muted-foreground/50 hover:text-muted-foreground text-xs"
                >
                  ▼
                </button>
              </div>

              {/* AM/PM */}
              <button
                type="button"
                onClick={handleAmPmToggle}
                className={cn(
                  "w-[44px] h-[44px] flex items-center justify-center rounded-[12px] ml-1",
                  "bg-[rgba(233,230,226,1)] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
                  "select-none cursor-pointer transition-all"
                )}
              >
                <span className="text-sm font-mono font-semibold text-foreground">
                  {isPM ? 'PM' : 'AM'}
                </span>
              </button>
            </div>
          </div>
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
            <div className="grid grid-cols-2 gap-3 p-3 rounded-[8px] bg-muted/50 shadow-engraved">
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

