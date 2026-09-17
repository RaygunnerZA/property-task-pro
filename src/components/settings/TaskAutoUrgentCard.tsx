import { AlarmClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTO_URGENT_HORIZONS } from "@/lib/autoUrgent";
import { useAutoUrgentPreference } from "@/hooks/useAutoUrgentPreference";

export function TaskAutoUrgentCard() {
  const { orgId, horizonId, setHorizonId } = useAutoUrgentPreference();
  const active = AUTO_URGENT_HORIZONS.find((horizon) => horizon.id === horizonId);

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <CardTitle>Task urgency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Open work due inside this window is treated as urgent — it appears in the Urgent
          list and counts — without changing the saved priority on the task.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5 pr-0 sm:pr-4">
            <Label htmlFor="auto-urgent-horizon" className="flex flex-wrap items-center gap-2">
              <AlarmClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              Automatically urgent
            </Label>
            <p className="text-xs text-muted-foreground">
              {active?.hint ?? "Choose when due dates should count as urgent."}
            </p>
          </div>
          <Select
            value={horizonId}
            onValueChange={(value) => {
              const next = AUTO_URGENT_HORIZONS.find((horizon) => horizon.id === value);
              if (next) setHorizonId(next.id);
            }}
            disabled={!orgId}
          >
            <SelectTrigger id="auto-urgent-horizon" className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_URGENT_HORIZONS.map((horizon) => (
                <SelectItem key={horizon.id} value={horizon.id}>
                  {horizon.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
