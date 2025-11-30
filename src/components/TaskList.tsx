import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import PageSection from "./PageSection";
import { SectionTitle } from "../design-system/DesignSystem";

export default function TaskList() {
  const { session } = useAuth();
  const orgId = session?.user?.user_metadata?.org_id || "";
  const { tasks, loading, error } = useTasks(orgId);

  if (loading) {
    return (
      <PageSection>
        <p className="text-[#6F6F6F] text-sm">Loading tasks...</p>
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection>
        <p className="text-red-600 text-sm">Error loading tasks</p>
      </PageSection>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <PageSection>
        <SectionTitle>Tasks</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">No tasks yet. Create your first task!</p>
      </PageSection>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="p-4 bg-white/60 backdrop-blur-md rounded-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
        >
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
      ))}
    </div>
  );
}
