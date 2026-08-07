import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type PropertyOption = {
  id: string;
  label: string;
  isArchived?: boolean;
};

type Props = {
  properties: PropertyOption[];
  maxActive: number;
  onConfirm: (keepIds: string[]) => Promise<void>;
  busy?: boolean;
  className?: string;
};

export function DowngradePropertyPicker({
  properties,
  maxActive,
  onConfirm,
  busy,
  className,
}: Props) {
  const active = useMemo(
    () => properties.filter((p) => !p.isArchived),
    [properties]
  );
  const [keepIds, setKeepIds] = useState<string[]>(() =>
    active.slice(0, maxActive).map((p) => p.id)
  );

  if (active.length <= maxActive) return null;

  function toggle(id: string) {
    setKeepIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= maxActive) return prev;
      return [...prev, id];
    });
  }

  const canConfirm =
    keepIds.length >= 1 && keepIds.length <= maxActive;

  return (
    <Card className={cn("shadow-e1", className)}>
      <CardHeader>
        <CardTitle className="text-base">Choose active properties</CardTitle>
        <CardDescription>
          Your plan allows {maxActive} active propert{maxActive === 1 ? "y" : "ies"}.
          Select which stay active — others are soft-archived (not deleted) and remain readable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {active.map((p) => {
            const checked = keepIds.includes(p.id);
            const disabled = !checked && keepIds.length >= maxActive;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 shadow-sm",
                  checked ? "bg-primary/10" : "bg-muted/40",
                  disabled && "opacity-60"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled || busy}
                  onCheckedChange={() => toggle(p.id)}
                  id={`keep-${p.id}`}
                />
                <label htmlFor={`keep-${p.id}`} className="text-sm flex-1 cursor-pointer">
                  {p.label}
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Selected {keepIds.length} of {maxActive} allowed.
        </p>
        <Button
          type="button"
          disabled={!canConfirm || busy || keepIds.length < 1 || keepIds.length > maxActive}
          onClick={() => void onConfirm(keepIds)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Soft-archive unselected
        </Button>
      </CardContent>
    </Card>
  );
}
