interface Props {
  value: "tasks" | "messages" | "reminders";
  onChange: (v: Props["value"]) => void;
}

export default function WorkSegmentControl({ value, onChange }: Props) {
  const tab = (id: Props["value"], label: string) => (
    <button
      onClick={() => onChange(id)}
      className={`flex-1 py-2 text-sm font-medium rounded-[12px] transition
        ${value === id
          ? "bg-white/70 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]"
          : "text-[#666]"
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-2 p-1 bg-white/40 backdrop-blur-md rounded-[14px] border border-black/5">
      {tab("tasks", "Tasks")}
      {tab("messages", "Messages")}
      {tab("reminders", "Reminders")}
    </div>
  );
}
