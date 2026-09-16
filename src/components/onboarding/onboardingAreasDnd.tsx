import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared chip DnD payload for Areas→Spaces (onboarding + Spaces screen).
 * Extension seam for Tasks / Assets / Records: add kinds (e.g. task, asset)
 * and droppable id prefixes without forking SortableItem / DroppableZone.
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
  | { kind: "unassigned"; spaceName: string; spaceId: string };

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
