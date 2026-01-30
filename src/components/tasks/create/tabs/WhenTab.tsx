import { useState } from "react";
import { Calendar, Repeat, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RepeatRule } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface WhenTabProps {
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

// Helper to get weekday name from date string
function getWeekdayName(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = parseISO(dateStr.split("T")[0]);
    return format(date, "EEEE");
  } catch {
    return "";
  }
}

export function WhenTab({ 
  dueDate, 
  repeatRule, 
  onDueDateChange, 
  onRepeatRuleChange 
}: WhenTabProps) {
  const [enableRepeat, setEnableRepeat] = useState(!!repeatRule);
  
  // Extract time from dueDate if it includes time
  const dueTime = dueDate.includes('T') ? dueDate.split('T')[1]?.slice(0, 5) : '';

  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    onDueDateChange(date.toISOString().split('T')[0]);
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
    <div className="space-y-4">
      {/* Quick Date Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Clock className="h-3.5 w-3.5" />
          Quick Select
        </Label>
        <div className="flex flex-wrap gap-2">
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
                    ? // Active: Pressed neumorphic with off-white fill
                      "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                    : // Inactive: Transparent with neumorphic shadows
                      "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Due Date and Time Picker */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dueDate" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Calendar className="h-3.5 w-3.5" />
            Due Date
          </Label>
          <div className="relative">
            <Input
              id="dueDate"
              type="date"
              value={dueDate.split('T')[0] || dueDate}
              onChange={(e) => {
                const time = dueTime || '09:00';
                onDueDateChange(`${e.target.value}T${time}`);
              }}
              className="shadow-engraved pr-20"
            />
            {dueDate && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                {getWeekdayName(dueDate)}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueTime" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Clock className="h-3.5 w-3.5" />
            Time
          </Label>
          <Input
            id="dueTime"
            type="time"
            value={dueTime}
            onChange={(e) => {
              const date = dueDate.split('T')[0] || new Date().toISOString().split('T')[0];
              onDueDateChange(`${date}T${e.target.value}`);
            }}
            className="shadow-engraved"
          />
        </div>
      </div>

      {/* Repeat Settings */}
      <div className="space-y-3 pt-2 border-t border-border/20">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Repeat className="h-3.5 w-3.5" />
            Repeat Task
          </Label>
          <Switch
            checked={enableRepeat}
            onCheckedChange={handleRepeatToggle}
            className="data-[state=checked]:bg-primary [&>span]:shadow-[0_2px_4px_rgba(0,0,0,0.3)] [&>span]:border [&>span]:border-white/20"
          />
        </div>

        {enableRepeat && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-[8px] bg-muted/50 shadow-engraved">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frequency</Label>
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
              <Label className="text-xs text-muted-foreground">Every</Label>
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
    </div>
  );
}
