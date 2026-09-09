import { Camera, MapPin, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import { toast } from "sonner";

type CaptureFlag = "require_task_photo" | "require_task_location" | "require_task_category";

const ROWS: {
  id: CaptureFlag;
  icon: typeof Camera;
  label: string;
  description: string;
}[] = [
  {
    id: "require_task_photo",
    icon: Camera,
    label: "Photo",
    description: "A photo must be attached when creating or completing a task.",
  },
  {
    id: "require_task_location",
    icon: MapPin,
    label: "Location",
    description: "Tasks must have a property and at least one space.",
  },
  {
    id: "require_task_category",
    icon: Tag,
    label: "Category",
    description: "Tasks must have a category such as electrical or plumbing.",
  },
];

export function TaskCaptureRequirementsCard() {
  const { settings, updateSettings, isUpdating } = useOrgSettings();
  const { isCoordinating, isLoading: accessLoading } = useEffectiveAccess();
  const canWrite = isCoordinating && !accessLoading;
  const locked = isUpdating || !canWrite;

  const handleToggle = async (flag: CaptureFlag, checked: boolean) => {
    try {
      await updateSettings({ [flag]: checked });
      toast.success(checked ? `${ROWS.find((r) => r.id === flag)?.label} required` : `${ROWS.find((r) => r.id === flag)?.label} optional`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Couldn't update this setting.";
      toast.error(
        /row-level security|permission denied/i.test(message)
          ? "Only Owners and Managers can change these settings."
          : message
      );
    }
  };

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <CardTitle>Task information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Require these fields so reports can filter by evidence, place, and trade.
          Missing fields block creating and completing a task.
        </p>
        {!canWrite && !accessLoading ? (
          <p className="text-xs text-muted-foreground">
            Only Owners and Managers can change these settings.
          </p>
        ) : null}
        {ROWS.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5 pr-0 sm:pr-4">
                <Label htmlFor={row.id} className="flex flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {row.label}
                </Label>
                <p className="text-xs text-muted-foreground">{row.description}</p>
              </div>
              <Switch
                id={row.id}
                className="shrink-0 sm:mt-0"
                checked={settings?.[row.id] === true}
                disabled={locked}
                onCheckedChange={(checked) => {
                  void handleToggle(row.id, checked);
                }}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
