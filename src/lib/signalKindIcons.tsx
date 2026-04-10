import type { ReactNode } from "react";
import type { SignalKind } from "@/types/workbenchSignals";
import {
  Activity,
  AlertTriangle,
  CloudRain,
  FileText,
  GitMerge,
  Mail,
  MessageSquare,
  Sparkles,
  Upload,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function signalKindIcon(kind: SignalKind, className?: string): ReactNode {
  const c = cn("h-4 w-4 shrink-0", className);
  switch (kind) {
    case "message":
      return <MessageSquare className={c} />;
    case "email":
      return <Mail className={c} />;
    case "upload":
      return <Upload className={c} />;
    case "ai_warning":
      return <AlertTriangle className={cn(c, "text-[#EB6834]")} />;
    case "ai_suggestion":
      return <Sparkles className={cn(c, "text-[#8EC9CE]")} />;
    case "admin":
      return <UserCog className={c} />;
    case "conflict":
      return <GitMerge className={c} />;
    case "weather":
      return <CloudRain className={c} />;
    case "document":
      return <FileText className={c} />;
    case "system":
      return <Activity className={c} />;
    default:
      return <Upload className={c} />;
  }
}
