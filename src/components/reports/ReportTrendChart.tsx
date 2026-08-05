import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChartAnnotation, ReportTrendPoint } from "@/lib/reports/types";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
import { MessageSquarePlus } from "lucide-react";

const chartConfig = {
  created: { label: "Created", color: FILLA_TURQUOISE },
  completed: { label: "Completed", color: "#64748b" },
} satisfies ChartConfig;

type Props = {
  trend: ReportTrendPoint[];
  annotations: ChartAnnotation[];
  canAnnotate?: boolean;
  onAddAnnotation?: (periodKey: string, note: string) => void;
};

export function ReportTrendChart({
  trend,
  annotations,
  canAnnotate,
  onAddAnnotation,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const annotationByKey = useMemo(() => {
    const map = new Map<string, ChartAnnotation[]>();
    for (const a of annotations) {
      const list = map.get(a.periodKey) ?? [];
      list.push(a);
      map.set(a.periodKey, list);
    }
    return map;
  }, [annotations]);

  if (trend.length === 0) {
    return (
      <section className="rounded-xl bg-card/70 p-5 shadow-e1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trend
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Not enough activity in this period to chart yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trend
        </h2>
        {canAnnotate && (
          <p className="text-xs text-muted-foreground">
            Click a period to add a note
          </p>
        )}
      </div>

      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <AreaChart
          data={trend}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
          onClick={(state) => {
            if (!canAnnotate) return;
            const key = (state?.activePayload?.[0]?.payload as ReportTrendPoint | undefined)
              ?.key;
            if (key) {
              setSelectedKey(key);
              setNote("");
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="created"
            stroke="var(--color-created)"
            fill="var(--color-created)"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="var(--color-completed)"
            fill="var(--color-completed)"
            fillOpacity={0.08}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>

      {annotations.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border/40 pt-3">
          {annotations.map((a) => (
            <li key={a.id} className="text-sm text-foreground">
              <span className="font-medium text-muted-foreground">{a.periodKey}</span>
              {" — "}
              {a.note}
            </li>
          ))}
        </ul>
      )}

      {canAnnotate && selectedKey && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:min-w-[7rem]">
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {selectedKey}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Major boiler replacement completed"
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!note.trim()}
              onClick={() => {
                onAddAnnotation?.(selectedKey, note.trim());
                setSelectedKey(null);
                setNote("");
              }}
            >
              Save note
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedKey(null)}
            >
              Cancel
            </Button>
          </div>
          {annotationByKey.get(selectedKey)?.length ? (
            <p className="text-xs text-muted-foreground sm:basis-full">
              Existing notes on this period will remain; this adds another.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
