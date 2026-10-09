import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dismissDescription, isDescriptionDismissed } from "@/lib/ephemeralDescription";

const VISIBLE_MS = 4000;

type EphemeralDescriptionProps = {
  /** Stable id. Dismissed ids stay closed until the next local calendar day. */
  id: string;
  children: ReactNode;
  className?: string;
};

/**
 * Contextual screen or section copy.
 * Stays readable for 4 seconds, then fades and the block collapses so content
 * below moves up. Closed for the rest of the day (including refresh).
 */
export function EphemeralDescription({ id, children, className }: EphemeralDescriptionProps) {
  const [open, setOpen] = useState(() => !isDescriptionDismissed(id));

  useEffect(() => {
    if (isDescriptionDismissed(id)) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const timer = window.setTimeout(() => {
      dismissDescription(id);
      setOpen(false);
    }, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [id]);

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-transform duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
            open ? "translate-y-0" : "-translate-y-[30px]"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
