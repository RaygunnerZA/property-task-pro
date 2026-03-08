/**
 * SidebarConcertina — Reusable collapsible sections for sidebar/left-column layouts.
 * Use on dashboard, property detail, and any screen that needs "Quick Actions",
 * "Compliance", "Recent Activity" or similar accordion blocks.
 */
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface SidebarConcertinaSection {
  id: string;
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  /** Bottom spacing: 'tight' (pb-0.5) or 'normal' (pb-2). Default 'tight'. */
  spacing?: "tight" | "normal";
  /** Extra class for the content wrapper (e.g. "space-y-1.5" or none). Default "space-y-1.5". */
  contentClassName?: string;
  children: React.ReactNode;
}

export interface SidebarConcertinaProps {
  sections: SidebarConcertinaSection[];
  className?: string;
}

const TRIGGER_CLASS = cn(
  "w-full h-10 min-h-10 flex items-center justify-between gap-2 px-3 py-0 text-left text-base font-semibold",
  "text-foreground hover:bg-muted/30 transition-colors"
);

const CONTENT_WRAPPER_CLASS = "px-3 pb-3 pt-0 border-t border-border/50";

export function SidebarConcertina({ sections, className }: SidebarConcertinaProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {sections.map((section) => {
        const Icon = section.icon;
        const spacingClass = section.spacing === "normal" ? "pb-2" : "pb-0.5";

        return (
          <div key={section.id} className={cn("px-0", spacingClass)}>
            <Collapsible defaultOpen={section.defaultOpen ?? false}>
              <CollapsibleTrigger className={TRIGGER_CLASS}>
                <span className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 text-primary shrink-0" />}
                  {section.title}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 data-[state=open]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className={cn(CONTENT_WRAPPER_CLASS, section.contentClassName ?? "space-y-1.5")}>
                  {section.children}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
  })}
    </div>
  );
}
