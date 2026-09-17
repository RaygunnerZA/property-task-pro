import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OnboardingDragData } from "@/components/onboarding/onboardingAreasDnd";

/**
 * Document row shell: drag listeners attach to `dragHandleProps` only
 * so checkboxes / menus stay clickable.
 */
export function DraggableRecordShell({
  id,
  data,
  disabled,
  className,
  children,
}: {
  id: string;
  data: OnboardingDragData;
  disabled?: boolean;
  className?: string;
  children: (opts: {
    dragHandleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
    disabled,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.45 : undefined,
    zIndex: isDragging ? 30 : undefined,
  };
  const dragHandleProps = disabled
    ? {}
    : { ...listeners, ...attributes, className: "touch-none cursor-grab active:cursor-grabbing" };

  return (
    <div ref={setNodeRef} style={style} className={cn(className)}>
      {children({ dragHandleProps, isDragging })}
    </div>
  );
}
