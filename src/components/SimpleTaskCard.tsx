interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
  };
}

export default function SimpleTaskCard({ task }: TaskCardProps) {
  return (
    <div className="p-4 bg-white/60 backdrop-blur-md rounded-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-[#1A1A1A] mb-1">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-[13px] text-[#6F6F6F]">{task.description}</p>
          )}
        </div>
        {task.status && (
          <span className="text-[11px] px-2 py-1 rounded-md bg-[#0E8388]/10 text-[#0E8388] font-medium">
            {task.status}
          </span>
        )}
      </div>
    </div>
  );
}
