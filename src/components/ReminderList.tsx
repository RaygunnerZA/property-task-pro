import { useReminders } from "../hooks/useReminders";
import EmptyState from "./EmptyState";

interface ReminderListProps {
  orgId?: string;
}

export default function ReminderList({ orgId }: ReminderListProps) {
  const { reminders, loading, error } = useReminders(orgId);

  if (loading) {
    return <EmptyState title="Loading reminders..." />;
  }

  if (error) {
    return <EmptyState title="Error loading reminders" subtitle={error} />;
  }

  if (reminders.length === 0) {
    return <EmptyState title="No reminders" subtitle="You have no upcoming reminders" />;
  }

  return (
    <div className="space-y-3">
      {reminders.map(reminder => (
        <div
          key={reminder.id}
          className="p-4 bg-white/60 backdrop-blur-md rounded-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-[#1A1A1A] mb-1">
                {reminder.title}
              </h3>
              {reminder.body && (
                <p className="text-[13px] text-[#6F6F6F]">{reminder.body}</p>
              )}
            </div>
            {reminder.due_at && (
              <span className="text-[11px] px-2 py-1 rounded-md bg-orange-100 text-orange-700 font-medium">
                {new Date(reminder.due_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
