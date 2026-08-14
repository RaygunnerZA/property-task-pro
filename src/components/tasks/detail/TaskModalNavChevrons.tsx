import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogContentClass } from "@/lib/layoutClasses";

type TaskModalNavChevronsProps = {
  prevId: string | null;
  nextId: string | null;
  onOpen: (id: string) => void;
  /** @deprecated Use onOpen */
  onOpenTask?: (taskId: string) => void;
  prevLabel?: string;
  nextLabel?: string;
};

const chevronClass =
  "task-modal-nav-chevron pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-[box-shadow] duration-150 focus-visible:outline-none";

/**
 * Prev/next task controls, fixed to the viewport so they never enter the modal
 * layout or get clipped by it. Vertically centred, snug to the dialog sides.
 * Desktop only.
 */
export function TaskModalNavChevrons({
  prevId,
  nextId,
  onOpen,
  onOpenTask,
  prevLabel = "Previous",
  nextLabel = "Next",
}: TaskModalNavChevronsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const open = onOpen ?? onOpenTask;
  if (!mounted || !open || (!prevId && !nextId)) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[120] hidden items-center justify-center lg:flex"
      aria-hidden={false}
    >
      <div className={cn("relative", dialogContentClass)}>
        {prevId ? (
          <button
            type="button"
            data-modal-nav
            data-task-nav
            aria-label={prevLabel}
            className={cn(chevronClass, "absolute right-full top-1/2 mr-[22px] -translate-y-1/2")}
            onClick={() => open(prevId)}
          >
            <ChevronLeft className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        {nextId ? (
          <button
            type="button"
            data-modal-nav
            data-task-nav
            aria-label={nextLabel}
            className={cn(chevronClass, "absolute left-full top-1/2 ml-[22px] -translate-y-1/2")}
            onClick={() => open(nextId)}
          >
            <ChevronRight className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
