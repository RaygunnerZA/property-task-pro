import { Link } from "react-router-dom";
import { ClipboardList, ShieldCheck, CalendarDays, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKBENCH_SECTION_ROUTES } from "@/lib/mainNavigation";
import { useSearchParams } from "react-router-dom";

const SECTION_LINKS = [
  {
    key: "issues",
    title: "Issues",
    description: "Signals, open work, and triage",
    icon: ClipboardList,
    iconClass: "text-[#FF6B6B]",
    to: WORKBENCH_SECTION_ROUTES.issues,
  },
  {
    key: "records",
    title: "Records",
    description: "Compliance, documents, and evidence",
    icon: ShieldCheck,
    iconClass: "text-primary",
    to: WORKBENCH_SECTION_ROUTES.records,
  },
  {
    key: "schedule",
    title: "Schedule",
    description: "Day agenda and upcoming work",
    icon: CalendarDays,
    iconClass: "text-foreground/70",
    to: WORKBENCH_SECTION_ROUTES.schedule,
  },
] as const;

export function HomeRightPanel() {
  const [searchParams] = useSearchParams();
  const property = searchParams.get("property");
  const suffix = property ? `?property=${encodeURIComponent(property)}` : "";

  return (
    <div className="flex h-full min-h-0 flex-col px-[10px] pt-3 pb-4 max-sm:px-0 max-pane:px-2">
      <p className="mb-3 text-sm text-muted-foreground">
        Jump into a workspace — each area has its own page now.
      </p>
      <div className="flex flex-col gap-2">
        {SECTION_LINKS.map(({ key, title, description, icon: Icon, iconClass, to }) => (
          <Link
            key={key}
            to={`${to}${suffix}`}
            className={cn(
              "group flex items-center gap-3 rounded-[12px] bg-card/60 px-3 py-3 shadow-e1",
              "transition-all hover:bg-card/85 hover:shadow-e2"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-background shadow-sm">
              <Icon className={cn("h-4 w-4", iconClass)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
