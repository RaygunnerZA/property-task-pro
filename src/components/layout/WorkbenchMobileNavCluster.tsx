import { useAssistantContext } from "@/contexts/AssistantContext";
import { useDataContext } from "@/contexts/DataContext";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { userAvatarUrl, userInitials } from "@/lib/userDisplayHelpers";

/**
 * Hub workbench (mobile): Filla AI opener + user avatar that opens the left navigation sheet.
 */
export function WorkbenchMobileNavCluster({ className }: { className?: string }) {
  const { openAssistant } = useAssistantContext();
  const { setOpenMobile } = useSidebar();
  const { user } = useDataContext();

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => openAssistant()}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-e1",
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
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-shadow",
          "bg-card shadow-e1 ring-2 ring-background hover:shadow-e2",
          "focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label="Open navigation menu"
      >
        <Avatar className="h-8 w-8 rounded-full">
          <AvatarImage src={userAvatarUrl(user)} alt="" className="object-cover" />
          <AvatarFallback
            className="rounded-full text-xs font-semibold"
            style={{ backgroundColor: "hsl(var(--primary) / 0.35)", color: "hsl(var(--foreground))" }}
          >
            {userInitials(user)}
          </AvatarFallback>
        </Avatar>
      </button>
    </div>
  );
}
