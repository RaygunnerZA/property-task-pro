import { ReactNode } from "react";
import { Building2, ClipboardList, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "filla.instruction.dismissed.";

export function instructionPanelStorageKey(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

/** Default spot illustration: line-style Lucide cluster (no raster assets). */
export function WorkspaceOverviewIllustration({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-card/80 shadow-engraved",
        className,
      )}
      aria-hidden
    >
      <Building2 className="absolute left-2 top-3 h-7 w-7 text-primary/90" strokeWidth={1.75} />
      <ClipboardList className="relative z-[1] h-9 w-9 text-ink" strokeWidth={1.75} />
      <Sparkles className="absolute bottom-2 right-2 h-6 w-6 text-accent" strokeWidth={1.75} />
    </div>
  );
}

export type InstructionPanelProps = {
  id: string;
  title: string;
  description: string;
  illustration?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

/**
 * Neumorphic callout for empty states, first-run hints, and “what to do here” guidance.
 * Keeps raised `shadow-e1` and optional soft primary wash — no flat redesign.
 */
export function InstructionPanel({
  id,
  title,
  description,
  illustration = <WorkspaceOverviewIllustration />,
  action,
  onDismiss,
  className,
}: InstructionPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-e1",
        className,
      )}
      role="region"
      aria-labelledby={`instruction-${id}-title`}
    >
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          aria-label="Dismiss tip"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1 space-y-2 pr-8 sm:pr-2">
          <h2 id={`instruction-${id}-title`} className="text-base font-semibold tracking-tight text-ink heading-l">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-foreground/80">{description}</p>
          {action && <div className="pt-1">{action}</div>}
        </div>
        {illustration && <div className="flex justify-center sm:justify-end">{illustration}</div>}
      </div>
    </div>
  );
}
