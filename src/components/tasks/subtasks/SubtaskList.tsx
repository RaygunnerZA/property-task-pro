import { useState, useRef, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SubtaskCard, SubtaskData } from "./SubtaskCard";

interface SubtaskListProps {
  subtasks: SubtaskData[];
  isCreator?: boolean;
  onSubtasksChange: (subtasks: SubtaskData[]) => void;
  onReorder?: (ids: string[]) => void;
}

export function SubtaskList({
  subtasks,
  isCreator = true,
  onSubtasksChange,
  onReorder,
}: SubtaskListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = subtasks.findIndex((s) => s.id === active.id);
      const newIndex = subtasks.findIndex((s) => s.id === over.id);

      const newSubtasks = arrayMove(subtasks, oldIndex, newIndex);
      onSubtasksChange(newSubtasks);
      onReorder?.(newSubtasks.map((s) => s.id));
    }
  };

  const handleUpdate = useCallback(
    (id: string, updates: Partial<SubtaskData>) => {
      onSubtasksChange(
        subtasks.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    [subtasks, onSubtasksChange]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const index = subtasks.findIndex((s) => s.id === id);
      const newSubtasks = subtasks.filter((s) => s.id !== id);
      onSubtasksChange(newSubtasks);

      // Focus previous or next
      if (newSubtasks.length > 0) {
        const focusIndex = Math.min(index, newSubtasks.length - 1);
        setFocusedId(newSubtasks[focusIndex].id);
      }
    },
    [subtasks, onSubtasksChange]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const subtask = subtasks.find((s) => s.id === id);
      if (!subtask) return;

      const index = subtasks.findIndex((s) => s.id === id);
      const newSubtask: SubtaskData = {
        ...subtask,
        id: crypto.randomUUID(),
        title: `${subtask.title} (copy)`,
      };

      const newSubtasks = [...subtasks];
      newSubtasks.splice(index + 1, 0, newSubtask);
      onSubtasksChange(newSubtasks);
      setFocusedId(newSubtask.id);
    },
    [subtasks, onSubtasksChange]
  );

  const handleEnterPress = useCallback(
    (id: string) => {
      const index = subtasks.findIndex((s) => s.id === id);
      const newSubtask: SubtaskData = {
        id: crypto.randomUUID(),
        title: "",
        is_yes_no: false,
        requires_signature: false,
      };

      const newSubtasks = [...subtasks];
      newSubtasks.splice(index + 1, 0, newSubtask);
      onSubtasksChange(newSubtasks);
      setFocusedId(newSubtask.id);
    },
    [subtasks, onSubtasksChange]
  );

  const handleBackspaceDelete = useCallback(
    (id: string) => {
      handleDelete(id);
    },
    [handleDelete]
  );

  const handleFocusPrevious = useCallback(
    (id: string) => {
      const index = subtasks.findIndex((s) => s.id === id);
      if (index > 0) {
        setFocusedId(subtasks[index - 1].id);
      }
    },
    [subtasks]
  );

  const handleFocusNext = useCallback(
    (id: string) => {
      const index = subtasks.findIndex((s) => s.id === id);
      if (index < subtasks.length - 1) {
        setFocusedId(subtasks[index + 1].id);
      }
    },
    [subtasks]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext
        items={subtasks.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {subtasks.map((subtask, index) => (
            <SubtaskCard
              key={subtask.id}
              subtask={subtask}
              index={index}
              isCreator={isCreator}
              autoFocus={focusedId === subtask.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onEnterPress={handleEnterPress}
              onBackspaceDelete={handleBackspaceDelete}
              onFocusPrevious={handleFocusPrevious}
              onFocusNext={handleFocusNext}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
