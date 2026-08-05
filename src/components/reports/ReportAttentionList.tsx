import { AlertTriangle, FileWarning, Radio } from "lucide-react";
import type { ReportAttentionItem } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

type Props = {
  items: ReportAttentionItem[];
};

const iconFor = {
  task: AlertTriangle,
  compliance: FileWarning,
  signal: Radio,
} as const;

export function ReportAttentionList({ items }: Props) {
  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Attention
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing critical in this scope right now.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = iconFor[item.kind];
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex min-w-0 flex-col gap-1.5 rounded-[10px] bg-background/80 p-3 shadow-e1"
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    item.severity === "high" ? "text-[#EB6834]" : "text-muted-foreground"
                  )}
                />
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {item.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
