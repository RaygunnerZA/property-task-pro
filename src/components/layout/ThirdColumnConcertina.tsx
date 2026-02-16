/**
 * ThirdColumnConcertina — Vertical accordion for third column
 * Unifies Create Task, Details, and Filla AI into a single concertina.
 * Uses Create Task design as primary style for closed headers.
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const PAPER_TEXTURE_STYLE = {
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
  backgroundSize: "100%",
};

const SECTION_HEADER_CLASS = cn(
  "px-4 pt-4 pb-4 w-full text-left",
  "flex items-center justify-between gap-3",
  "bg-[linear-gradient(90deg,rgba(255,255,255,0.74)_0%,rgba(255,255,255,0)_100%)] transition-colors hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.74)_0%,rgba(255,255,255,0)_100%)]",
  "shadow-[inset_-2px_-2px_3px_-2px_rgba(0,0,0,0.3),inset_2px_3px_2.5px_0px_rgba(255,255,255,0.4)]"
);

export interface ConcertinaSection {
  id: string;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

interface ThirdColumnConcertinaProps {
  sections: ConcertinaSection[];
  className?: string;
}

export function ThirdColumnConcertina({ sections, className }: ThirdColumnConcertinaProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-background rounded-[12px] shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 overflow-hidden",
        className
      )}
      style={PAPER_TEXTURE_STYLE}
    >
      {sections.map((section, index) => {
        const isFirst = index === 0;
        const isLast = index === sections.length - 1;
        const isExpanded = section.isExpanded;

        return (
          <div key={section.id} className="flex flex-col">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={`concertina-body-${section.id}`}
              onClick={section.onToggle}
              className={cn(
                SECTION_HEADER_CLASS,
                isFirst && "rounded-t-[12px]",
                isLast && !isExpanded && "rounded-b-[12px]",
                !isFirst && "border-t-0"
              )}
            >
              <h2 className="text-lg font-semibold text-[#85BABC]">{section.title}</h2>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-[#85BABC] shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#85BABC] shrink-0" />
              )}
            </button>

            <div
              id={`concertina-body-${section.id}`}
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
                isExpanded ? "max-h-[70vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0 pointer-events-none"
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
