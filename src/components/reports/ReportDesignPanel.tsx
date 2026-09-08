import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkspaceSurfaceCard } from "@/components/property-workspace";
import { DATE_RANGE_OPTIONS } from "@/lib/reports/dateRange";
import {
  ALL_REPORT_TASK_STATUSES,
  REPORT_SECTION_LABELS,
} from "@/lib/reports/designFilters";
import { REPORT_TEMPLATES, getReportTemplate } from "@/lib/reports/templates";
import { TASK_STATUS_VISUALS } from "@/lib/taskStatus";
import type {
  ReportDateRangePreset,
  ReportDesignFilters,
  ReportSectionId,
  ReportTaskStatusFilter,
  ReportTemplateId,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

export type ReportDesignDraft = {
  templateId: ReportTemplateId;
  dateRangePreset: ReportDateRangePreset;
  propertyId: string; // "all" or id
  filters: ReportDesignFilters;
};

type SpaceOption = { id: string; name: string; propertyId?: string | null };
type PropertyOption = { id: string; name: string };

type ReportDesignPanelProps = {
  draft: ReportDesignDraft;
  onChange: (next: ReportDesignDraft) => void;
  properties: PropertyOption[];
  spaces: SpaceOption[];
  showPropertySelect?: boolean;
  /** When true, template cannot change (editing an existing workspace). */
  lockTemplate?: boolean;
  className?: string;
  footer?: ReactNode;
};

function toggleInList<T extends string>(list: T[], value: T, on: boolean): T[] {
  if (on) return list.includes(value) ? list : [...list, value];
  return list.filter((v) => v !== value);
}

export function ReportDesignPanel({
  draft,
  onChange,
  properties,
  spaces,
  showPropertySelect = true,
  lockTemplate = false,
  className,
  footer,
}: ReportDesignPanelProps) {
  const template = getReportTemplate(draft.templateId);

  const scopedSpaces = useMemo(() => {
    if (draft.propertyId === "all") return spaces;
    return spaces.filter((s) => s.propertyId === draft.propertyId);
  }, [spaces, draft.propertyId]);

  const availableSections = useMemo(() => {
    const set = new Set<ReportSectionId>([
      ...template.sections,
      ...template.propertyScopedExtras,
      "notes",
    ]);
    return (Object.keys(REPORT_SECTION_LABELS) as ReportSectionId[]).filter(
      (id) => set.has(id)
    );
  }, [template]);

  const selectedSections =
    draft.filters.sectionIds ?? [...template.sections];

  const patch = (partial: Partial<ReportDesignDraft>) => {
    onChange({ ...draft, ...partial });
  };

  const patchFilters = (partial: Partial<ReportDesignFilters>) => {
    onChange({
      ...draft,
      filters: { ...draft.filters, ...partial },
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <WorkspaceSurfaceCard
        title="Report design"
        description="Choose the template and which data appears in the workspace"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Template</Label>
            <Select
              value={draft.templateId}
              disabled={lockTemplate}
              onValueChange={(v) => {
                const templateId = v as ReportTemplateId;
                const nextTemplate = getReportTemplate(templateId);
                patch({
                  templateId,
                  filters: {
                    ...draft.filters,
                    sectionIds: [...nextTemplate.sections],
                  },
                });
              }}
            >
              <SelectTrigger className="w-full border-0 bg-background/80 shadow-e1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-2xs text-muted-foreground">{template.question}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date range</Label>
            <Select
              value={draft.dateRangePreset}
              onValueChange={(v) =>
                patch({ dateRangePreset: v as ReportDateRangePreset })
              }
            >
              <SelectTrigger className="w-full border-0 bg-background/80 shadow-e1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showPropertySelect ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Property</Label>
              <Select
                value={draft.propertyId}
                onValueChange={(propertyId) =>
                  patch({
                    propertyId,
                    filters: { ...draft.filters, spaceIds: [] },
                  })
                }
              >
                <SelectTrigger className="w-full border-0 bg-background/80 shadow-e1">
                  <SelectValue placeholder="Property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All properties</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard
        title="Task status"
        description="Include tasks in these statuses"
      >
        <div className="flex flex-col gap-2">
          {ALL_REPORT_TASK_STATUSES.map((status) => {
            const visual = TASK_STATUS_VISUALS[status];
            const checked = draft.filters.taskStatuses.includes(status);
            return (
              <label
                key={status}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    patchFilters({
                      taskStatuses: toggleInList(
                        draft.filters.taskStatuses,
                        status,
                        v === true
                      ),
                    })
                  }
                />
                <span className="text-sm text-foreground">{visual.label}</span>
              </label>
            );
          })}
          {draft.filters.taskStatuses.length === 0 ? (
            <p className="text-2xs text-warning-foreground">
              Select at least one status, or the task list will be empty.
            </p>
          ) : null}
        </div>
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard
        title="Spaces"
        description={
          scopedSpaces.length === 0
            ? "No spaces in this scope yet"
            : "Leave empty for all spaces, or pick specific ones"
        }
      >
        {scopedSpaces.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Spaces appear when the selected property has them.
          </p>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            <div className="mb-1 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs"
                onClick={() => patchFilters({ spaceIds: [] })}
              >
                All spaces
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs"
                onClick={() =>
                  patchFilters({ spaceIds: scopedSpaces.map((s) => s.id) })
                }
              >
                Select all
              </Button>
            </div>
            {scopedSpaces.map((space) => {
              const checked =
                draft.filters.spaceIds.length === 0
                  ? false
                  : draft.filters.spaceIds.includes(space.id);
              const impliedAll = draft.filters.spaceIds.length === 0;
              return (
                <label
                  key={space.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={impliedAll ? true : checked}
                    onCheckedChange={(v) => {
                      if (impliedAll) {
                        // Switching from “all” to explicit: select only this space, or all but this.
                        if (v === true) {
                          patchFilters({ spaceIds: [space.id] });
                        } else {
                          patchFilters({
                            spaceIds: scopedSpaces
                              .filter((s) => s.id !== space.id)
                              .map((s) => s.id),
                          });
                        }
                        return;
                      }
                      const next = toggleInList(
                        draft.filters.spaceIds,
                        space.id,
                        v === true
                      );
                      patchFilters({
                        spaceIds:
                          next.length === scopedSpaces.length ? [] : next,
                      });
                    }}
                  />
                  <span className="truncate text-sm text-foreground">
                    {space.name}
                  </span>
                </label>
              );
            })}
            {draft.filters.spaceIds.length === 0 ? (
              <p className="pt-1 text-2xs text-muted-foreground">
                All spaces included
              </p>
            ) : (
              <p className="pt-1 text-2xs text-muted-foreground">
                {draft.filters.spaceIds.length} space
                {draft.filters.spaceIds.length === 1 ? "" : "s"} selected
              </p>
            )}
          </div>
        )}
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard
        title="Sections"
        description="Toggle which blocks appear in the workspace"
      >
        <div className="flex flex-col gap-2">
          {availableSections.map((sectionId) => {
            const checked = selectedSections.includes(sectionId);
            return (
              <label
                key={sectionId}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = toggleInList(
                      selectedSections,
                      sectionId,
                      v === true
                    );
                    patchFilters({
                      sectionIds: next.length > 0 ? next : [sectionId],
                    });
                  }}
                />
                <span className="text-sm text-foreground">
                  {REPORT_SECTION_LABELS[sectionId]}
                </span>
              </label>
            );
          })}
        </div>
      </WorkspaceSurfaceCard>

      {footer}
    </div>
  );
}
