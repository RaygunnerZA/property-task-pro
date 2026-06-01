import { SegmentControl } from "@/components/filla/SegmentControl";
import {
  TASK_DETAIL_CONTEXTS,
  type TaskDetailContextId,
} from "@/components/tasks/detail/taskDetailContexts";

type TaskDetailContextTabsProps = {
  value: TaskDetailContextId;
  onChange: (value: TaskDetailContextId) => void;
  className?: string;
};

export function TaskDetailContextTabs({
  value,
  onChange,
  className,
}: TaskDetailContextTabsProps) {
  return (
    <SegmentControl
      className={className}
      compact
      options={TASK_DETAIL_CONTEXTS.map((c) => ({ id: c.id, label: c.label }))}
      selectedId={value}
      onChange={(id) => onChange(id as TaskDetailContextId)}
    />
  );
}
