import { mapTask } from "../utils/mapTask";

export default function TaskCard({ 
  task, 
  property, 
  onClick 
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
}) {
  const t = mapTask(task);
  const hasImage = task?.image_url;

  return (
    <div 
      className="rounded-[16px] bg-white/60 backdrop-blur-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)] cursor-pointer hover:scale-[1.01] transition-transform overflow-hidden flex"
      onClick={onClick}
    >
      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[15px] font-semibold line-clamp-1">{t.title}</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-black/5 whitespace-nowrap ml-2">{t.status}</span>
        </div>

        <div className="mt-2 text-xs text-[#666] flex gap-4 flex-wrap">
          {property && <span>🏠 {property.name || property.address}</span>}
          <span>⏰ {t.due_at ? new Date(t.due_at).toLocaleDateString() : "No due date"}</span>
        </div>
      </div>

      {/* Image Zone - Right side, no padding on top/right/bottom */}
      {hasImage && (
        <div className="w-20 sm:w-24 flex-shrink-0">
          <img 
            src={task.image_url} 
            alt={t.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}