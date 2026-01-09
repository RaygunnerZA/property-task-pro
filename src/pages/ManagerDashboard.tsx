import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { StatCard } from '@/components/dashboard/StatCard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics';
import { useTasksQuery } from '@/hooks/useTasksQuery';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  CheckSquare, 
  AlertTriangle, 
  Shield,
  Clock,
  LayoutDashboard,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';
import DashboardSection from '@/components/dashboard/DashboardSection';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Safety check: Ensure we have an org
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { metrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics();
  const { data: tasksData = [], isLoading: tasksLoading, error: tasksError } = useTasksQuery();

  // Safe defaults if data loading fails - show 0 instead of crashing
  const safeMetrics = useMemo(() => {
    if (metricsError || !metrics) {
      return {
        total_properties: 0,
        open_tasks: 0,
        overdue_tasks: 0,
        expiring_compliance: 0
      };
    }
    return metrics;
  }, [metrics, metricsError]);

  // Parse tasks from view (handles JSON arrays and assignee mapping)
  const safeTasks = useMemo(() => {
    if (tasksError || !tasksData) {
      return [];
    }
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
      // Map title from tasks_view
      title: task.title,
    }));
  }, [tasksData, tasksError]);

  // Get last 5 modified tasks (sorted by updated_at)
  const recentTasks = useMemo(() => {
    if (!safeTasks || safeTasks.length === 0) return [];
    return [...safeTasks]
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at).getTime();
        const bTime = new Date(b.updated_at || b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [safeTasks]);

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  if (orgLoading || metricsLoading || tasksLoading) {
    return (
      <StandardPage
        title="Welcome to Filla"
        subtitle="Your workspace overview"
        icon={<LayoutDashboard className="h-6 w-6" />}
        maxWidth="xl"
      >
        <LoadingState message="Loading dashboard..." />
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title="Welcome to Filla"
      subtitle="Your workspace overview"
      icon={<LayoutDashboard className="h-6 w-6" />}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <NeomorphicButton size="sm" onClick={() => navigate("/properties")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </NeomorphicButton>
          <NeomorphicButton size="sm" onClick={() => navigate("/assets")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </NeomorphicButton>
          <NeomorphicButton size="sm" onClick={() => navigate("/tasks")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </NeomorphicButton>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Properties"
            value={safeMetrics.total_properties}
            icon={Building2}
            variant="default"
          />
          <StatCard
            label="Open Tasks"
            value={safeMetrics.open_tasks}
            icon={CheckSquare}
            variant="default"
          />
          <StatCard
            label="Overdue Tasks"
            value={safeMetrics.overdue_tasks}
            icon={AlertTriangle}
            variant={safeMetrics.overdue_tasks > 0 ? "accent" : "default"}
          />
          <StatCard
            label="Expiring Compliance"
            value={safeMetrics.expiring_compliance}
            icon={Shield}
            variant={safeMetrics.expiring_compliance > 0 ? "warning" : "default"}
          />
        </div>

        {/* Recent Activity */}
        <DashboardSection title="Recent Activity">
          <Card className="shadow-e1">
            <CardContent>
              {recentTasks.length === 0 ? (
                <div className="py-8 text-muted-foreground">
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-all",
                        "bg-input",
                        "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
                        "hover:scale-[1.01] active:scale-[0.99]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">
                            {(task as any).title || "Untitled Task"}
                          </h4>
                          <Badge variant="neutral" size="sm" className="mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {format(new Date(task.updated_at || task.created_at), "MMM d, HH:mm")}
                            </span>
                          </Badge>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge
                            variant={
                              task.status === "completed"
                                ? "success"
                                : task.status === "in_progress"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {task.status || "open"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </DashboardSection>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </StandardPage>
  );
};

export default ManagerDashboard;
