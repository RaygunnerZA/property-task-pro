import { useState } from "react";
import { Calendar, Repeat, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { RepeatRule } from "@/types/database";
import { cn } from "@/lib/utils";

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

export function WhenTab({ 
  dueDate, 
  repeatRule, 
  onDueDateChange, 
  onRepeatRuleChange 
}: WhenTabProps) {
  const [enableRepeat, setEnableRepeat] = useState(!!repeatRule);

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
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Quick Select
        </Label>
        <div className="flex flex-wrap gap-2">
          {quickDates.map(({ label, days }) => (
            <Badge
              key={label}
              variant="outline"
              className="cursor-pointer font-mono text-xs uppercase hover:bg-primary hover:text-primary-foreground transition-all"
              onClick={() => setQuickDate(days)}
            >
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Due Date Picker */}
      <div className="space-y-2">
        <Label htmlFor="dueDate" className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Due Date
        </Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="shadow-engraved"
        />
      </div>

      {/* Repeat Settings */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Repeat Task
          </Label>
          <Switch
            checked={enableRepeat}
            onCheckedChange={handleRepeatToggle}
          />
        </div>

        {enableRepeat && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50 shadow-engraved">
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
