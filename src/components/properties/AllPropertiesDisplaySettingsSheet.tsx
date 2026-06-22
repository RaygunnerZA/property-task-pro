import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  getAllPropertiesDisplaySettings,
  setAllPropertiesDisplaySettings,
} from "@/lib/allPropertiesDisplayPreferences";

type AllPropertiesDisplaySettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyCount: number;
  onSaved?: () => void;
};

export function AllPropertiesDisplaySettingsSheet({
  open,
  onOpenChange,
  propertyCount,
  onSaved,
}: AllPropertiesDisplaySettingsSheetProps) {
  const { orgId } = useActiveOrg();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  useEffect(() => {
    if (!open || !orgId) return;
    const settings = getAllPropertiesDisplaySettings(orgId);
    setTitle(settings.title ?? "");
    setSubtitle(settings.subtitle ?? "");
  }, [open, orgId]);

  const handleSave = () => {
    if (!orgId) return;
    setAllPropertiesDisplaySettings(orgId, {
      title: title.trim() || null,
      subtitle: subtitle.trim() || null,
    });
    onSaved?.();
    onOpenChange(false);
  };

  const defaultSubtitle =
    propertyCount === 1
      ? "1 property in your portfolio"
      : `${propertyCount} properties in your portfolio`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>All properties display</SheetTitle>
          <SheetDescription>
            Customise how the portfolio card appears on your home screen.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="all-properties-title">Card title</Label>
            <Input
              id="all-properties-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="All properties"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="all-properties-subtitle">Card description</Label>
            <Input
              id="all-properties-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={defaultSubtitle}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default portfolio count.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-8">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
