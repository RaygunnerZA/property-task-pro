import { Fullscreen, PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { TaskOpenMode } from "@/lib/taskOpenMode";

type TaskOpenModeSwitchProps = {
  value: TaskOpenMode;
  onChange: (mode: TaskOpenMode) => void;
  className?: string;
};

/**
 * Neumorphic icon switch for wide-screen task open preference.
 * Left = fullscreen modal · Right = right-column panel (default).
 */
export function TaskOpenModeSwitch({ value, onChange, className }: TaskOpenModeSwitchProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Open task view"
      className={cn(
        "inline-flex items-center gap-[5px] rounded-[8px] bg-muted/40 p-1 shadow-engraved",
        className
      )}
    >
      <ModeButton
        active={value === "fullscreen"}
        label="Full screen"
        onClick={() => onChange("fullscreen")}
      >
        <Fullscreen className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
      </ModeButton>
      <ModeButton
        active={value === "panel"}
        label="Right panel"
        onClick={() => onChange("panel")}
      >
        <PanelRight className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px]",
        "transition-[box-shadow,color,background-color] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        active
          ? "bg-card text-foreground shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-1px_-1px_2px_0px_rgba(255,255,255,0.85)]"
          : "bg-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
