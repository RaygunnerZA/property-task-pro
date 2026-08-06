import { cn } from "@/lib/utils";
import { getTaskStatusVisual } from "@/lib/taskStatus";

type TaskStatusMarkProps = {
  status: string | null | undefined;
  /** Matches OVERDUE chip height on task thumbnails. */
  size?: "chip" | "sm";
  className?: string;
  /** Spin the in-progress loader. */
  animateLoader?: boolean;
};

/**
 * Filled status block with icon — locked top-left on task thumbnails.
 */
export function TaskStatusMark({
  status,
  size = "chip",
  className,
  animateLoader = false,
}: TaskStatusMarkProps) {
  const visual = getTaskStatusVisual(status);
  const Icon = visual.Icon;
  const dim = size === "chip" ? "h-[22px] w-[22px]" : "h-5 w-5";
  const iconDim = size === "chip" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[5px] shadow-sm",
        dim,
        visual.blockClassName,
        className
      )}
      title={visual.label}
      aria-label={visual.label}
    >
      <Icon
        className={cn(
          iconDim,
          visual.iconClassName,
          animateLoader && visual.status === "in_progress" && "animate-spin"
        )}
        strokeWidth={2.25}
        aria-hidden
      />
    </span>
  );
}
