import { DS } from "../design-system/DesignSystem";

interface WorkSegmentControlProps {
  value: "tasks" | "messages" | "reminders";
  onChange: (value: "tasks" | "messages" | "reminders") => void;
}

export default function WorkSegmentControl({ value, onChange }: WorkSegmentControlProps) {
  const segments = [
    { id: "tasks" as const, label: "Tasks", icon: "✓" },
    { id: "messages" as const, label: "Messages", icon: "💬" },
    { id: "reminders" as const, label: "Reminders", icon: "⏰" }
  ];

  return (
    <div className="flex gap-2 p-1 bg-white/40 backdrop-blur-sm rounded-[12px]">
      {segments.map((seg) => (
        <button
          key={seg.id}
          onClick={() => onChange(seg.id)}
          className={`flex-1 py-2 px-3 rounded-[10px] text-[13px] font-medium transition-all ${
            value === seg.id
              ? "bg-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)] text-[#0E8388]"
              : "text-[#6F6F6F]"
          }`}
        >
          <span className="mr-1">{seg.icon}</span>
          {seg.label}
        </button>
      ))}
    </div>
  );
}
