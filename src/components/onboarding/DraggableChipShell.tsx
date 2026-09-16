import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OnboardingDragData } from "./onboardingAreasDnd";

export function DraggableChipShell({
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 30 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-none inline-flex", className)}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
