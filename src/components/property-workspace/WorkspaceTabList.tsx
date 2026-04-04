import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared tab strip for Column 2 — same rhythm as other property workspaces.
 */
export function WorkspaceTabList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex flex-wrap gap-1.5 p-1 rounded-xl bg-muted/40 shadow-engraved",
        className
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceTabTrigger({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
        selected
          ? "bg-card text-foreground shadow-e1"
          : "text-muted-foreground hover:text-foreground hover:bg-card/50"
      )}
    >
      {children}
    </button>
  );
}
