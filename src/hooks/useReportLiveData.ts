import { useMemo } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { useSignalsQuery } from "@/hooks/useSignalsQuery";
import { buildLiveReportData } from "@/lib/reports/metrics";
import { buildFoyerBriefLines, buildReportBriefParagraph } from "@/lib/reports/brief";
import type { ReportDateRangePreset, ReportTemplateId } from "@/lib/reports/types";

export function useReportLiveData(input: {
  propertyIds: string[];
  dateRangePreset: ReportDateRangePreset;
  templateId?: ReportTemplateId;
}) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { data: properties = [], isLoading: propsLoading } = usePropertiesQuery();
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: compliance = [], isLoading: complianceLoading } =
    useCompliancePortfolioQuery();
  const propertyIdsForSignals =
    input.propertyIds.length > 0 && input.propertyIds.length < properties.length
      ? input.propertyIds
      : undefined;
  const { data: signals = [], isLoading: signalsLoading } = useSignalsQuery({
    propertyIds: propertyIdsForSignals,
  });

  const allPropertyIds = useMemo(
    () =>
      properties
        .map((p) => p.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    [properties]
  );

  const scopeLabel = useMemo(() => {
    if (
      input.propertyIds.length === 0 ||
      input.propertyIds.length >= allPropertyIds.length
    ) {
      return allPropertyIds.length <= 1 ? "This property" : "Portfolio";
    }
    if (input.propertyIds.length === 1) {
      const p = properties.find((row) => row.id === input.propertyIds[0]);
      return (
        p?.nickname?.trim() ||
        p?.address?.trim() ||
        "Property"
      );
    }
    return `${input.propertyIds.length} properties`;
  }, [input.propertyIds, allPropertyIds.length, properties]);

  const isSingleProperty =
    input.propertyIds.length === 1 || allPropertyIds.length === 1;

  const live = useMemo(
    () =>
      buildLiveReportData({
        tasks,
        compliance,
        signals,
        propertyIds: input.propertyIds,
        allPropertyIds,
        preset: input.dateRangePreset,
      }),
    [
      tasks,
      compliance,
      signals,
      input.propertyIds,
      allPropertyIds,
      input.dateRangePreset,
    ]
  );

  const brief = useMemo(
    () =>
      input.templateId
        ? buildReportBriefParagraph({
            templateId: input.templateId,
            scopeLabel,
            periodLabel: live.range.label,
            kpis: live.kpis,
            previousKpis: live.previousKpis,
            tasks: filterForBrief(tasks, input.propertyIds, allPropertyIds),
            compliance,
            signals,
          })
        : buildFoyerBriefLines({
            scopeLabel,
            periodLabel: live.range.label,
            kpis: live.kpis,
            previousKpis: live.previousKpis,
            tasks: filterForBrief(tasks, input.propertyIds, allPropertyIds),
            compliance,
            signals,
          }),
    [
      input.templateId,
      scopeLabel,
      live.range.label,
      live.kpis,
      live.previousKpis,
      tasks,
      compliance,
      signals,
      input.propertyIds,
      allPropertyIds,
    ]
  );

  const isLoading =
    orgLoading ||
    propsLoading ||
    tasksLoading ||
    complianceLoading ||
    signalsLoading ||
    !orgId;

  return {
    isLoading,
    properties,
    allPropertyIds,
    scopeLabel,
    isSingleProperty,
    brief,
    ...live,
  };
}

function filterForBrief(
  tasks: { property_id?: string | null }[],
  propertyIds: string[],
  allPropertyIds: string[]
) {
  const scopeAll =
    propertyIds.length === 0 || propertyIds.length >= allPropertyIds.length;
  if (scopeAll) return tasks;
  const set = new Set(propertyIds);
  return tasks.filter((t) => t.property_id && set.has(t.property_id));
}
