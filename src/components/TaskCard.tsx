export default function TaskCard({ 
  task, 
  property, 
  onClick 
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
}) {
  return (
    <div 
      className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)] cursor-pointer hover:scale-[1.01] transition-transform"
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-[15px] font-semibold">{task.title || "Task Title"}</h3>

        <span className="text-xs px-2 py-1 rounded-full bg-black/5">
          {task.status || "open"}
        </span>
      </div>

      <div className="mt-2 text-xs text-[#666] flex gap-4">
        <span>🏠 {property?.name || task.property || "Property"}</span>
        <span>⏰ {task.due_at || "No due date"}</span>
      </div>
    </div>
  );
}
