import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type WeekendPushNoticeProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

/**
 * Shown under When/repeat controls when a repeating task lands on Sat/Sun.
 */
export function WeekendPushNotice({
  checked,
  onCheckedChange,
  className,
}: WeekendPushNoticeProps) {
  return (
    <label
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-card bg-background/80 px-2.5 py-2",
        "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.08),-1px_-1px_2px_0px_rgba(255,255,255,0.7)]",
        className
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5 shrink-0"
        aria-label="Push to Monday"
      />
      <span className="min-w-0 text-caption leading-snug text-muted-foreground">
        This repeated task falls on a weekend.{" "}
        <span className="text-foreground">Push to Monday?</span>
      </span>
    </label>
  );
}
