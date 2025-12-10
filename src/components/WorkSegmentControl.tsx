import { cn } from '@/lib/utils';

interface Props {
  value: "tasks" | "messages" | "reminders";
  onChange: (v: Props["value"]) => void;
}

export default function WorkSegmentControl({ value, onChange }: Props) {
  const tab = (id: Props["value"], label: string) => (
    <button
      onClick={() => onChange(id)}
      className={cn(
        'flex-1 py-2.5 text-sm font-medium rounded-[5px] transition-all',
        value === id
          ? 'bg-card text-primary shadow-e1'
          : 'text-muted-foreground hover:text-ink'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-1 p-1 bg-concrete/30 rounded-[5px] border border-concrete">
      {tab("tasks", "Tasks")}
      {tab("messages", "Messages")}
      {tab("reminders", "Reminders")}
    </div>
  );
}
