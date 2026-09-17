/**
 * ThirdColumnConcertina — Vertical accordion for third column
 * Unifies Create Task, Details, and Filla AI into a single concertina.
 * Uses Create Task design as primary style for closed headers.
 */
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FillaIcon } from "@/components/filla/FillaIcon";

const PAPER_TEXTURE_STYLE = {
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.42\'%3E%3C/rect%3E%3C/svg%3E")',
  backgroundSize: "100%",
};

const SECTION_HEADER_CLASS = cn(
  "px-4 pt-[15px] pb-[15px] h-[55px] w-full text-left",
  "flex items-center justify-between gap-3",
  "bg-transparent transition-colors hover:bg-transparent",
  "shadow-none"
);

export interface ConcertinaSection {
  id: string;
  title: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  /** Inline block without accordion header (e.g. drop zone). */
  variant?: "accordion" | "static";
  /**
   * When false, body stays open and the chevron collapse control is omitted.
   * Use `headerTrailing` for an alternate header control (e.g. open-mode switch).
   */
  collapsible?: boolean;
  /** Replaces the expand/collapse chevron when provided (or shown beside title when not collapsible). */
  headerTrailing?: ReactNode;
}

interface ThirdColumnConcertinaProps {
  sections: ConcertinaSection[];
  className?: string;
}

export function ThirdColumnConcertina({ sections, className }: ThirdColumnConcertinaProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-background rounded-xl shadow-none border-0 overflow-visible mx-0 box-border min-w-0 w-full max-w-full px-0",
        className
      )}
      style={PAPER_TEXTURE_STYLE}
    >
      {sections.map((section, index) => {
        const isFirst = index === 0;
        const isLast = index === sections.length - 1;
        const isStatic = section.variant === "static";

        if (isStatic) {
          return (
            <div
              key={section.id}
              className={cn(
                "px-0 py-[5px]",
                !isFirst && "border-t border-border/10"
              )}
            >
              {section.children}
            </div>
          );
        }

        const collapsible = section.collapsible !== false;
        const isExpanded = collapsible ? (section.isExpanded ?? false) : true;
        const headerTrailing =
          section.headerTrailing ??
          (collapsible ? (
            isExpanded ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-primary" />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-primary" />
            )
          ) : null);

        const headerClassName = cn(
          SECTION_HEADER_CLASS,
          isFirst && "rounded-t-xl",
          isLast && !isExpanded && "rounded-b-xl",
          !isFirst && "border-t-0"
        );

        const headerInner = (
          <>
            <div className="flex min-w-0 items-center gap-2">
              {section.id === "assistant" && (
                <FillaIcon size={20} className="shrink-0 text-primary" />
              )}
              <h2 className="text-lg font-semibold text-primary">{section.title}</h2>
            </div>
            {headerTrailing ? (
              <div
                className="shrink-0"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {headerTrailing}
              </div>
            ) : null}
          </>
        );

        return (
          <div key={section.id} className="flex flex-col">
            {collapsible ? (
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={`concertina-body-${section.id}`}
                onClick={section.onToggle}
                className={headerClassName}
              >
                {headerInner}
              </button>
            ) : (
              <div className={headerClassName}>{headerInner}</div>
            )}

            <div
              id={`concertina-body-${section.id}`}
              aria-hidden={!isExpanded}
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
                section.id === "details" &&
                  "rounded-xl shadow-[3px_4px_5.4px_0px_rgba(0,0,0,0.15),-3px_-7px_4.8px_0px_rgba(255,255,255,0.7)] [overflow-anchor:none]",
                isExpanded
                  ? // Details: grow with content (top-aligned); scroll the column, not an inner 70vh frame.
                    section.id === "details"
                    ? "max-h-none opacity-100"
                    : "max-h-[70vh] opacity-100 overflow-y-auto"
                  : "max-h-0 opacity-0 pointer-events-none"
              )}
            >
              {section.children}
            </div>
          </div>
        );
      })}
    </div>
  );
}
