import { useAuth } from "../hooks/useAuth";
import { useReminders } from "../hooks/useReminders";
import PageSection from "./PageSection";
import { SectionTitle } from "../design-system/DesignSystem";

export default function ReminderList() {
  const { session } = useAuth();
  const orgId = session?.user?.user_metadata?.org_id || "";
  const { reminders, loading, error } = useReminders(orgId);

  if (loading) {
    return (
      <PageSection>
        <p className="text-[#6F6F6F] text-sm">Loading reminders...</p>
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection>
        <p className="text-red-600 text-sm">Error loading reminders</p>
      </PageSection>
    );
  }

  if (!reminders || reminders.length === 0) {
    return (
      <PageSection>
        <SectionTitle>Reminders</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">No reminders scheduled.</p>
      </PageSection>
    );
  }

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="p-4 bg-white/60 backdrop-blur-md rounded-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-[#1A1A1A] mb-1">
                {reminder.title}
              </h3>
              {reminder.description && (
                <p className="text-[13px] text-[#6F6F6F]">{reminder.description}</p>
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
