import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "accent" | "warning";
}

export function StatCard({ label, value, icon: Icon, variant = "default" }: StatCardProps) {
  const variantStyles = {
    default: {
      bg: "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
      icon: "text-[#8EC9CE]",
      value: "text-foreground",
      shadow: "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
    },
    accent: {
      bg: "bg-gradient-to-br from-[#EB6834]/10 via-[#EB6834]/5 to-[#EB6834]/10",
      icon: "text-[#EB6834]",
      value: "text-[#EB6834]",
      shadow: "shadow-[3px_5px_8px_rgba(235,104,52,0.2),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
    },
    warning: {
      bg: "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-amber-500/10",
      icon: "text-amber-600",
      value: "text-amber-600",
      shadow: "shadow-[3px_5px_8px_rgba(245,158,11,0.2),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "rounded-xl p-4 transition-all duration-150",
        styles.bg,
        styles.shadow
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <Icon className={cn("h-5 w-5", styles.icon)} />
      </div>
      <div className={cn("text-2xl font-bold font-mono mb-1", styles.value)}>
        {value.toLocaleString()}
      </div>
      <div className="text-sm font-medium text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

