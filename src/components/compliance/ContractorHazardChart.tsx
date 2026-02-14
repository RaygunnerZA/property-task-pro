import { useMemo } from "react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { HAZARD_CATEGORIES, getHazardLabel } from "@/lib/hazards";
import type { ContractorComplianceItem } from "@/hooks/useContractorComplianceQuery";

interface ContractorHazardChartProps {
  items: ContractorComplianceItem[];
}

const HAZARD_COLORS: Record<string, string> = {
  fire: "#EB6834",
  electrical: "#F59E0B",
  slip: "#F59E0B",
  water: "#3B82F6",
  structural: "#EA580C",
  obstruction: "#F59E0B",
  hygiene: "#0D9488",
  ventilation: "#0EA5E9",
  unknown: "#6B7280",
};

export function ContractorHazardChart({ items }: ContractorHazardChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    const byContractor = new Map<
      string,
      { name: string; [h: string]: string | number }
    >();

    for (const item of items) {
      const cid = item.contractor_org_id;
      const name = item.contractor_name;
      let row = byContractor.get(cid);
      if (!row) {
        row = { name: name.length > 12 ? name.slice(0, 12) + "…" : name };
        for (const h of HAZARD_CATEGORIES) row[h] = 0;
        byContractor.set(cid, row);
      }
      const hazards = Array.isArray(item.hazards) ? item.hazards : [];
      for (const h of hazards) {
        if (HAZARD_CATEGORIES.includes(h)) {
          row[h] = (row[h] as number) + 1;
        }
      }
    }

    const data = Array.from(byContractor.values()).filter((r) =>
      HAZARD_CATEGORIES.some((h) => (r[h] as number) > 0)
    );

    if (data.length === 0) return { chartData: [], chartConfig: {} };

    const config: Record<string, { label: string; color: string }> = {};
    for (const h of HAZARD_CATEGORIES) {
      config[h] = { label: getHazardLabel(h), color: HAZARD_COLORS[h] ?? "#6B7280" };
    }

    return { chartData: data, chartConfig: config };
  }, [items]);

  if (chartData.length === 0) return null;

  return (
    <ChartContainer
      config={chartConfig}
      className="h-[min(280px,40vh)] w-full"
    >
      <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis type="number" dataKey="" />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="fire" stackId="h" fill="var(--color-fire)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="electrical" stackId="h" fill="var(--color-electrical)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="slip" stackId="h" fill="var(--color-slip)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="water" stackId="h" fill="var(--color-water)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="structural" stackId="h" fill="var(--color-structural)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="obstruction" stackId="h" fill="var(--color-obstruction)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="hygiene" stackId="h" fill="var(--color-hygiene)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="ventilation" stackId="h" fill="var(--color-ventilation)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="unknown" stackId="h" fill="var(--color-unknown)" radius={[2, 2, 2, 2]} />
      </BarChart>
    </ChartContainer>
  );
}
