import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CreateTaskModal } from "./CreateTaskModal";
import { SectionHeader } from "@/components/filla/SectionHeader";
import { cn } from "@/lib/utils";

interface CreateTaskPanelProps {
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Callback when expansion state changes */
  onToggle: () => void;
  /** Callback when task is created */
  onTaskCreated?: () => void;
  /** Default property ID */
  defaultPropertyId?: string;
  /** Default due date */
  defaultDueDate?: Date;
}

/**
 * CreateTaskPanel - Concertina-style panel for third column
 * 
 * Uses CreateTaskModal logic but wraps it in a collapsible panel
 * that stacks vertically with other third-column panels.
 */
export function CreateTaskPanel({
  isExpanded,
  onToggle,
  onTaskCreated,
  defaultPropertyId,
  defaultDueDate,
}: CreateTaskPanelProps) {
  return (
    <div className="flex flex-col bg-background rounded-lg shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 relative overflow-hidden" style={{
      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
      backgroundSize: '100%'
    }}>
      {/* Accordion Header */}
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={cn(
          "px-4 pt-4 pb-4 border-b border-border/30 w-full text-left",
          "flex items-center justify-between gap-3",
          "bg-[#85BABC] transition-colors hover:bg-[#85BABC]",
          "rounded-t-[12px] shadow-[inset_-2px_-2px_3px_-2px_rgba(0,0,0,0.3),inset_2px_3px_2.5px_0px_rgba(255,255,255,0.4)]"
        )}
      >
        <h2 className="text-lg font-semibold text-white">Create Task</h2>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-white" />
        ) : (
          <ChevronDown className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Accordion Body */}
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <CreateTaskModal
          open={isExpanded}
          onOpenChange={(open) => {
            if (!open) {
              onToggle();
            }
          }}
          onTaskCreated={onTaskCreated}
          defaultPropertyId={defaultPropertyId}
          defaultDueDate={defaultDueDate}
          variant="column"
        />
      </div>
    </div>
  );
}
