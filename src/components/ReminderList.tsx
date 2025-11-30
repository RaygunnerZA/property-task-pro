import { useReminders } from "../hooks/useReminders";
import SkeletonTaskCard from "./SkeletonTaskCard";
import EmptyState from "./EmptyState";

export default function ReminderList({ orgId }: { orgId?: string }) {
  const { reminders, loading, error } = useReminders(orgId);

  if (loading) return (
    <div className="space-y-3">
      <SkeletonTaskCard />
      <SkeletonTaskCard />
    </div>
  );

  if (error) return <EmptyState title="Unable to load reminders" subtitle={error} />;

  if (!reminders.length) return (
    <EmptyState title="No reminders" subtitle="Scheduled reminders will appear here" />
  );

  return (
    <div className="space-y-3">
      {reminders.map(r => (
        <div key={r.id} className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md shadow">
          <div className="text-sm font-medium">{r.title}</div>
          <div className="text-xs text-[#666] mt-1">{r.due_at ? new Date(r.due_at).toLocaleString() : "No due date"}</div>
        </div>
      ))}
    </div>
  );
}
