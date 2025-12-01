import { useSystemStatus } from "@/hooks/useSystemStatus";
import { cn } from "@/lib/utils";
import { WifiOff, AlertCircle, RefreshCw } from "lucide-react";

export function StatusBanner() {
  const { status } = useSystemStatus();

  if (status === "healthy") {
    return null;
  }

  const config = {
    offline: {
      message: "Offline — reconnecting…",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-900 dark:text-amber-200",
      icon: WifiOff,
    },
    degraded: {
      message: "Connection is unstable",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-900 dark:text-blue-200",
      icon: AlertCircle,
    },
    critical: {
      message: "Trying to restore connection",
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-900 dark:text-red-200",
      icon: RefreshCw,
    },
  };

  const { message, bg, border, text, icon: Icon } = config[status];

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b py-2 px-4",
        "flex items-center justify-center gap-2",
        "animate-in slide-in-from-top-2 duration-300",
        bg,
        border,
        text
      )}
    >
      <Icon className="h-4 w-4 animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
