import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared chip DnD payload for Areas→Spaces and Assets→Spaces.
 * Extension seam for Tasks / Records: add kinds and droppable id prefixes
 * without forking SortableItem / DroppableZone.
 */
export type OnboardingDragData =
  | { kind: "area"; areaId: string }
  | {
      kind: "space";
      spaceName: string;
      areaId: string;
      /** Persisted spaces use UUID; onboarding name-only drafts omit this. */
      spaceId?: string;
    }
  | { kind: "suggestion"; spaceName: string; groupId: string }
  | { kind: "unassigned"; spaceName: string; spaceId: string }
  | {
      kind: "asset";
      assetId: string;
      assetName: string;
      spaceId?: string | null;
    }
  | { kind: "asset-suggestion"; assetName: string; groupId: string }
  | { kind: "unassigned-asset"; assetId: string; assetName: string };

export function areaSortableId(areaId: string) {
  return `area:${areaId}`;
}

export function spaceSortableId(areaId: string, spaceName: string) {
  return `space:${areaId}:${spaceName.toLowerCase().trim()}`;
}

/** Persisted-room sortable id — preferred on Spaces screen. */
export function spaceIdSortableId(areaId: string, spaceId: string) {
  return `space-id:${areaId}:${spaceId}`;
}

export function parseSpaceSortableId(
  id: string
): { areaId: string; spaceKey: string } | null {
  if (!id.startsWith("space:")) return null;
  const rest = id.slice("space:".length);
  const idx = rest.indexOf(":");
  if (idx < 0) return null;
  return { areaId: rest.slice(0, idx), spaceKey: rest.slice(idx + 1) };
}

export function parseSpaceIdSortableId(
  id: string
): { areaId: string; spaceId: string } | null {
  if (!id.startsWith("space-id:")) return null;
  const rest = id.slice("space-id:".length);
  const idx = rest.indexOf(":");
  if (idx < 0) return null;
  return { areaId: rest.slice(0, idx), spaceId: rest.slice(idx + 1) };
}

export function unassignedSortableId(spaceId: string) {
  return `unassigned:${spaceId}`;
}

export function groupDroppableId(groupId: string) {
  return `group:${groupId}`;
}

export function areaDroppableId(areaId: string) {
  return `area-drop:${areaId}`;
}

export function spacesListDroppableId() {
  return "spaces-list";
}

export function spaceDroppableId(spaceId: string) {
  return `space-drop:${spaceId}`;
}

export function parseSpaceDroppableId(id: string): string | null {
  if (!id.startsWith("space-drop:")) return null;
  const spaceId = id.slice("space-drop:".length);
  return spaceId || null;
}

export function assetSortableId(assetId: string) {
  return `asset:${assetId}`;
}

export function unassignedAssetSortableId(assetId: string) {
  return `unassigned-asset:${assetId}`;
}

export function parseAssetSortableId(id: string): string | null {
  if (!id.startsWith("asset:")) return null;
  const assetId = id.slice("asset:".length);
  return assetId || null;
}

export function parseUnassignedAssetSortableId(id: string): string | null {
  if (!id.startsWith("unassigned-asset:")) return null;
  const assetId = id.slice("unassigned-asset:".length);
  return assetId || null;
}

export function spaceAssetsListDroppableId() {
  return "space-assets-list";
}

export function unassignedAssetsListDroppableId() {
  return "unassigned-assets-list";
}

export function assetChipDragId(assetId: string) {
  return `asset-chip:${assetId}`;
}

export function assetSuggestionDragId(groupId: string, nameKey: string) {
  return `asset-suggestion:${groupId}:${nameKey}`;
}

export function onboardingDragLabel(
  drag: OnboardingDragData,
  areaName?: string
): string {
  switch (drag.kind) {
    case "area":
      return areaName ?? "Area";
    case "space":
    case "unassigned":
    case "suggestion":
      return drag.spaceName;
    case "asset":
    case "unassigned-asset":
    case "asset-suggestion":
      return drag.assetName;
  }
}

export function SortableItem({
  id,
  data,
  className,
  children,
}: {
  id: string;
  data: OnboardingDragData;
  className?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(className, "touch-none")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function DroppableZone({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "ring-2 ring-primary/40 rounded-[8px]")}
    >
      {children}
    </div>
  );
}
