import { useAssistantContext } from "@/contexts/AssistantContext";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const WORKBENCH_HAMBURGER_ICON = "/icons/workbench/hamburger.svg";

/**
 * Hub workbench (mobile): Filla AI opener + hamburger that opens the left navigation sheet.
 */
export function WorkbenchMobileNavCluster({ className }: { className?: string }) {
  const { openAssistant } = useAssistantContext();
  const { setOpenMobile } = useSidebar();

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => openAssistant()}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[12px] bg-card shadow-e1",
          "transition-shadow hover:shadow-e2"
        )}
        aria-label="Open Filla AI"
      >
        <FillaIcon size={16} />
      </button>
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] outline-none transition-shadow",
          "bg-card shadow-e1 hover:shadow-e2",
          "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label="Open navigation menu"
      >
        <img
          src={WORKBENCH_HAMBURGER_ICON}
          alt=""
          className="h-5 w-5 object-contain"
          width={20}
          height={20}
        />
      </button>
    </div>
  );
}
