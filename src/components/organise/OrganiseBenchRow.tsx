import type { ReactNode } from "react";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingDragData } from "@/components/onboarding/onboardingAreasDnd";
import { DraggableRecordShell } from "@/components/records/DraggableRecordShell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type BenchRowAction = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  icon?: ReactNode;
};

export type BenchRowChip = {
  id: string;
  label: string;
  color?: string;
};

type OrganiseBenchRowProps = {
  dragId: string;
  dragData: OnboardingDragData;
  dragDisabled?: boolean;
  title: string;
  /** Second line, e.g. "Circulation · 3 assets · 1 open task". */
  meta?: ReactNode;
  /** Place chips (area / space) shown on the meta line. */
  chips?: BenchRowChip[];
  /** Left coin accent (collection colour). */
  accentColor?: string;
  alert?: string | null;
  onOpen: () => void;
  actions?: BenchRowAction[];
  className?: string;
};

/**
 * Bench row — information-rich entity row shared by the Spaces and Assets
 * benches (shelf–bench–drawer grammar, @Docs/04_UI_System.md). Clicking the
 * row opens detail; the grip starts the filing gesture (drag opens the
 * places drawer). Small colour-coded coin, never large art.
 */
export function OrganiseBenchRow({
  dragId,
  dragData,
  dragDisabled = false,
  title,
  meta,
  chips = [],
  accentColor,
  alert,
  onOpen,
  actions = [],
  className,
}: OrganiseBenchRowProps) {
  return (
    <DraggableRecordShell id={dragId} data={dragData} disabled={dragDisabled}>
      {({ dragHandleProps }) => (
        <div
          className={cn(
            "group flex items-center gap-2 rounded-[10px] bg-card px-2.5 py-2 shadow-e1",
            "transition-shadow hover:shadow-md",
            className
          )}
        >
          {!dragDisabled ? (
            <button
              type="button"
              aria-label={`Drag ${title} to a place`}
              {...(dragHandleProps as Record<string, unknown>)}
              className={cn(
                "flex h-7 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60",
                "hover:text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
              )}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <span
            aria-hidden
            className="h-7 w-7 shrink-0 rounded-[6px] bg-background shadow-engraved"
            style={
              accentColor
                ? { borderLeft: `3px solid ${accentColor}` }
                : undefined
            }
          />

          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-[6px]"
          >
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {title}
              </span>
              {alert ? (
                <span className="shrink-0 font-mono text-2xs uppercase tracking-wide text-destructive">
                  {alert}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {meta ? (
                <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  {meta}
                </span>
              ) : null}
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex items-center rounded-[6px] bg-background px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-foreground/80 shadow-e1"
                  style={
                    chip.color
                      ? { boxShadow: `inset 2px 0 0 ${chip.color}` }
                      : undefined
                  }
                >
                  {chip.label}
                </span>
              ))}
            </span>
          </button>

          {actions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${title} options`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 hover:bg-background hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {actions.map((action, i) => {
                  const prevDestructive = actions[i - 1]?.destructive;
                  return (
                    <span key={action.label}>
                      {action.destructive && !prevDestructive && i > 0 ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      <DropdownMenuItem
                        className={cn(
                          action.destructive &&
                            "text-destructive focus:text-destructive"
                        )}
                        onSelect={action.onClick}
                      >
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    </span>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}
    </DraggableRecordShell>
  );
}
