import { Info, ShieldAlert } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  REGULATED_AREA_TOOLTIP,
  STARTER_TEMPLATE_DETAIL_CALLOUT,
  STARTER_TEMPLATE_SUMMARY,
} from "@/lib/starterTemplateDisclaimer";
import { cn } from "@/lib/utils";

interface StarterTemplateCalloutProps {
  variant?: "detail" | "compact";
  /** Include regulated-area disclaimer in the same block (detail views). */
  isRegulatedArea?: boolean;
}

export function RegulatedAreaBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-mono uppercase tracking-wider bg-accent/10 text-accent cursor-help",
              className
            )}
          >
            <ShieldAlert className="h-3 w-3" aria-hidden />
            Regulated Area
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal py-2 text-xs leading-relaxed"
        >
          {REGULATED_AREA_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StarterTemplateCallout({
  variant = "detail",
  isRegulatedArea = false,
}: StarterTemplateCalloutProps) {
  if (variant === "compact") {
    return (
      <p className="text-xs text-muted-foreground/80 leading-relaxed">{STARTER_TEMPLATE_SUMMARY}</p>
    );
  }

  return (
    <div
      className={`flex gap-2.5 rounded-xl px-3.5 py-3 shadow-sm ${
        isRegulatedArea ? "bg-primary/6 ring-1 ring-accent/15" : "bg-primary/8"
      }`}
    >
      <Info className="h-4 w-4 shrink-0 text-primary-deep mt-0.5" aria-hidden />
      <div className="space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-primary-deep">Starting template</span>
          {isRegulatedArea && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-mono uppercase tracking-wider bg-accent/10 text-accent">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              Regulated Area
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {STARTER_TEMPLATE_DETAIL_CALLOUT}
          {isRegulatedArea && (
            <>
              {" "}
              {REGULATED_AREA_TOOLTIP}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
