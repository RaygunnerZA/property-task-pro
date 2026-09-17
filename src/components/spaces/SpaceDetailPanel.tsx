/**
 * SpaceDetailPanel — view a space or area without leaving the organise surface.
 * Modal on narrow viewports; column variant for the workbench right rail.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, FolderOpen, Package, Shield, X, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/design-system/EmptyState";
import { useSpaceDetail } from "@/hooks/useSpaceDetail";
import { useSpaceComplianceQuery } from "@/hooks/useSpaceComplianceQuery";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { getSpaceDisplayIllustration } from "@/lib/spaceTypeIllustrations";
import { toSentenceCaseSpaceName } from "@/lib/spaceNameUtils";
import { dialogContentClass, columnShellClass } from "@/lib/layoutClasses";
import { cn } from "@/lib/utils";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

type SpaceDetailPanelProps = {
  spaceId: string | null;
  propertyId?: string;
  onClose: () => void;
  /** modal = overlay; column = right-rail context panel */
  variant?: "modal" | "column";
};

export function SpaceDetailPanel({
  spaceId,
  propertyId,
  onClose,
  variant = "modal",
}: SpaceDetailPanelProps) {
  const navigate = useNavigate();
  const { data: space, isLoading, isError } = useSpaceDetail(spaceId ?? undefined);
  const resolvedPropertyId = propertyId || space?.property_id || undefined;
  const { data: compliance = [] } = useSpaceComplianceQuery(spaceId ?? undefined);
  const { data: allAssets = [] } = useAssetsQuery(resolvedPropertyId);
  const { data: tasksData = [] } = useTasksQuery(resolvedPropertyId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const assetsInSpace = useMemo(() => {
    if (!spaceId) return [];
    return allAssets.filter((a: { space_id?: string | null }) => a.space_id === spaceId);
  }, [allAssets, spaceId]);

  const spaceTasks = useMemo(() => {
    if (!spaceId) return [];
    return tasksData
      .map((task: any) => ({
        ...task,
        spaces: typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces || [],
      }))
      .filter((task: any) => {
        if (task.status === "completed" || task.status === "archived") return false;
        if (!Array.isArray(task.spaces)) return false;
        return task.spaces.some((s: any) => s?.id === spaceId);
      });
  }, [tasksData, spaceId]);

  if (!spaceId) return null;

  const spaceWithProps = space as
    | (NonNullable<typeof space> & {
        properties?: { nickname?: string; address?: string };
        thumbnail_url?: string | null;
        parent_space_id?: string | null;
      })
    | undefined;

  const spaceName = toSentenceCaseSpaceName(spaceWithProps?.name) || "Unnamed Space";
  const propertyName =
    spaceWithProps?.properties?.nickname ||
    spaceWithProps?.properties?.address ||
    "Property";
  const kindLabel =
    spaceWithProps?.parent_space_id
      ? "Space"
      : spaceWithProps?.icon_name === "layers"
        ? "Area"
        : "Space";

  const thumbnailSrc = getSpaceDisplayIllustration({
    name: spaceWithProps?.name,
    thumbnail_url: spaceWithProps?.thumbnail_url,
  });

  const openFullPage = () => {
    if (!resolvedPropertyId || !spaceId) return;
    navigate(`/properties/${resolvedPropertyId}/spaces/${spaceId}`);
  };

  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background bg-paper-texture">
      <div className="relative shrink-0">
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/40">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <img
              src={thumbnailSrc}
              alt=""
              className="h-full w-full max-h-full object-contain p-4"
            />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError || !spaceWithProps ? (
          <EmptyState
            icon={FolderOpen}
            title="Not found"
            description="This space is unavailable or was removed."
          />
        ) : (
          <>
            <div className="space-y-1">
              <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {kindLabel}
              </p>
              <h2 className="text-lg font-semibold leading-tight text-foreground">{spaceName}</h2>
              <p className="text-xs text-muted-foreground">{propertyName}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {spaceWithProps.floor_level ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Floor</dt>
                  <dd className="font-medium">{spaceWithProps.floor_level}</dd>
                </div>
              ) : null}
              {spaceWithProps.area_sqm != null ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Area</dt>
                  <dd className="font-medium">{spaceWithProps.area_sqm} m²</dd>
                </div>
              ) : null}
            </dl>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-card bg-card/70 px-2.5 py-2 text-center shadow-e1">
                <ListChecks className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-semibold tabular-nums">{spaceTasks.length}</p>
                <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  Tasks
                </p>
              </div>
              <div className="rounded-card bg-card/70 px-2.5 py-2 text-center shadow-e1">
                <Package className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-semibold tabular-nums">{assetsInSpace.length}</p>
                <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  Assets
                </p>
              </div>
              <div className="rounded-card bg-card/70 px-2.5 py-2 text-center shadow-e1">
                <Shield className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-semibold tabular-nums">{compliance.length}</p>
                <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  Records
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                Open tasks
              </p>
              {spaceTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open tasks linked here.</p>
              ) : (
                <ul className="space-y-1.5">
                  {spaceTasks.slice(0, 6).map((task: any) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="w-full rounded-lg bg-card/80 px-3 py-2 text-left text-sm font-medium shadow-e1 transition-shadow hover:shadow-md"
                      >
                        {task.title || "Untitled task"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {resolvedPropertyId ? (
              <Button
                type="button"
                variant="outline"
                className="w-full btn-neomorphic gap-2"
                onClick={openFullPage}
              >
                <ExternalLink className="h-4 w-4" />
                Open full space
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  if (variant === "column") {
    return (
      <>
        <div className={cn(columnShellClass, "overflow-hidden rounded-xl border-0 bg-background shadow-e1")}>
          {body}
        </div>
        {selectedTaskId ? (
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onOpenTask={setSelectedTaskId}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          hideCloseButton
          className={cn(
            dialogContentClass,
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden bg-background bg-paper-texture p-0"
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{spaceName}</DialogTitle>
            <DialogDescription>Space details</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
      {selectedTaskId ? (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onOpenTask={setSelectedTaskId}
        />
      ) : null}
    </>
  );
}
