import { useMemo, useState } from 'react';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardCalendarV2 } from '@/components/dashboard/DashboardCalendarV2';
import { CheckSquare, Calendar, Building2, AlertCircle, Clock, Home as HomeIcon, Shield, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTasksQuery } from '@/hooks/useTasksQuery';
import { useCompliancePortfolioQuery } from '@/hooks/useCompliancePortfolioQuery';
import { StandardPage } from '@/components/design-system/StandardPage';
import DashboardSection from '@/components/dashboard/DashboardSection';
import { PanelSectionTitle } from '@/components/ui/panel-section-title';

const Home = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data: tasksData = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();

  // Parse tasks from view (handles JSON arrays and assignee mapping)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assigned_user_id,
      // Map due_date from tasks_view
      due_at: task.due_date,
    }));
  }, [tasksData]);


  // Stats derived from real data
  const activeTasks = tasks.filter(t => t.status !== 'completed').length;
  const urgentTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

  const complianceSummary = useMemo(() => {
    const expired = compliancePortfolio.filter((c: any) => c.expiry_state === 'expired').length;
    const expiring = compliancePortfolio.filter((c: any) => c.expiry_state === 'expiring').length;
    const valid = compliancePortfolio.filter((c: any) => c.expiry_state === 'valid').length;
    return { expired, expiring, valid };
  }, [compliancePortfolio]);

  const stats = [
    { label: 'Active Tasks', value: activeTasks, icon: CheckSquare, colorClass: 'text-primary', link: '/work/tasks' },
    { label: 'This Week', value: tasks.length, icon: Calendar, colorClass: 'text-signal-foreground', link: '/work/schedule' },
    { label: 'Properties', value: 4, icon: Building2, colorClass: 'text-accent', link: '/manage/properties' },
    { label: 'Urgent', value: urgentTasks, icon: AlertCircle, colorClass: 'text-destructive', link: '/work/tasks' },
  ];

  const recentActivity = [
    { text: 'Task completed: Fire safety inspection', time: '2h ago', colorClass: 'bg-success' },
    { text: 'New task assigned: HVAC maintenance', time: '5h ago', colorClass: 'bg-signal' },
    { text: 'Property updated: 123 Main St', time: '1d ago', colorClass: 'bg-accent' },
  ];

  const upcomingReminders = [
    { title: 'Monthly inspection due', property: 'Oak Plaza', time: 'Tomorrow 9:00 AM' },
    { title: 'Vendor meeting scheduled', property: 'Main Street', time: 'Wed 2:00 PM' },
  ];

  return (
    <StandardPage
      title="Home"
      subtitle="Your workspace overview"
      icon={<HomeIcon className="h-6 w-6" />}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Calendar */}
        <div className="rounded-xl bg-transparent p-4 shadow-e1">
          <DashboardCalendarV2
            tasks={tasks}
            selectedDate={selectedDate}
            onDateSelect={(date) => setSelectedDate(date || new Date())}
          />
        </div>

        {/* Compliance Health Today */}
        <button
          type="button"
          onClick={() => navigate('/record/compliance/portfolio')}
          className="w-full p-4 rounded-lg text-left bg-card shadow-e1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] border border-border/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-surface-gradient shadow-engraved">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <PanelSectionTitle as="h3" className="mb-0">
                  Your Compliance Health Today
                </PanelSectionTitle>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  {complianceSummary.expired > 0 && (
                    <span className="text-destructive font-medium">{complianceSummary.expired} expired</span>
                  )}
                  {complianceSummary.expiring > 0 && (
                    <span className="text-amber-600 font-medium">{complianceSummary.expiring} expiring</span>
                  )}
                  {complianceSummary.valid > 0 && (
                    <span className="text-success">{complianceSummary.valid} valid</span>
                  )}
                  {complianceSummary.expired === 0 && complianceSummary.expiring === 0 && complianceSummary.valid === 0 && (
                    <span className="text-muted-foreground">No compliance items</span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={() => navigate(stat.link)}
              className="p-4 rounded-lg text-left bg-card shadow-e1 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-surface-gradient shadow-engraved">
                  <stat.icon className={`h-5 w-5 ${stat.colorClass}`} />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight mb-1 text-foreground">
                {stat.value}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </div>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <DashboardSection title="Recent Activity">
          <Card className="shadow-e1">
            <CardContent className="p-4">
              <div className="space-y-4">
                {recentActivity.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${item.colorClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed text-foreground">
                        {item.text}
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm" className="text-[10px] px-2 py-0.5 shrink-0">
                      {item.time}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </DashboardSection>

        {/* Upcoming Reminders */}
        <DashboardSection title="Upcoming">
          <div className="space-y-3">
            {upcomingReminders.map((reminder, idx) => (
              <Card key={idx} className="shadow-e1">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg shrink-0 bg-surface-gradient shadow-engraved">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5 text-foreground">
                        {reminder.title}
                      </p>
                      <p className="text-xs mb-1 text-muted-foreground font-mono">
                        {reminder.property}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="warning" size="sm" className="text-[10px] px-2 py-0.5">
                          {reminder.time}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DashboardSection>
      </div>
      <FloatingAddButton />
    </StandardPage>
  );
};

export default Home;
