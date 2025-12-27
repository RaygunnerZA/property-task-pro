import { useMemo, useState } from 'react';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { Badge } from '@/components/ui/badge';
import { MiniCalendar, type CalendarEvent } from '@/components/filla/MiniCalendar';
import { CheckSquare, Calendar, Building2, AlertCircle, Clock, Home as HomeIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { StandardPage } from '@/components/design-system/StandardPage';

const Home = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { tasks } = useTasks();

  // Convert tasks to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const byDate = new Map<string, typeof tasks>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const dateStr = task.due_date.slice(0, 10);
      const existing = byDate.get(dateStr) || [];
      existing.push(task);
      byDate.set(dateStr, existing);
    }

    return Array.from(byDate.entries()).map(([date, dayTasks]) => ({
      date,
      tasks: dayTasks.map((t) => ({
        priority: (t.priority || 'normal') as 'low' | 'normal' | 'high',
      })),
      compliance: [],
    }));
  }, [tasks]);

  // Stats derived from real data
  const activeTasks = tasks.filter(t => t.status !== 'completed').length;
  const urgentTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

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
        {/* Mini Calendar */}
        <MiniCalendar
          selectedDate={selectedDate}
          events={calendarEvents}
          onSelect={(date) => setSelectedDate(date)}
          showMonthNav={true}
        />

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={() => navigate(stat.link)}
              className="p-4 rounded-lg text-left bg-card shadow-e1 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-background shadow-engraved">
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
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Recent Activity
            </h2>
          </div>
          <div className="rounded-lg p-4 bg-card shadow-e1">
            <div className="space-y-4">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${item.colorClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed text-foreground">
                      {item.text}
                    </p>
                  </div>
                  <span className="text-xs shrink-0 text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Reminders */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Upcoming
            </h2>
            <Badge variant="primary">{upcomingReminders.length}</Badge>
          </div>
          <div className="space-y-3">
            {upcomingReminders.map((reminder, idx) => (
              <div
                key={idx}
                className="rounded-lg p-4 bg-card shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg shrink-0 bg-background shadow-engraved">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold mb-0.5 text-foreground">
                      {reminder.title}
                    </p>
                    <p className="text-xs mb-1 text-muted-foreground">
                      {reminder.property}
                    </p>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-signal" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {reminder.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      <FloatingAddButton />
    </StandardPage>
  );
};

export default Home;
