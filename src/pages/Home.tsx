import { useMemo, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { ContextHeader } from '@/components/ContextHeader';
import { colors, shadows } from '@/components/filla';
import { Badge } from '@/components/filla/DesignSystem';
import { MiniCalendar, type CalendarEvent } from '@/components/filla/MiniCalendar';
import { CheckSquare, Calendar, Building2, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';

const Home = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { tasks } = useTasks();

  // Convert tasks to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const byDate = new Map<string, typeof tasks>();
    for (const task of tasks) {
      if (!task.due_at) continue;
      const dateStr = task.due_at.slice(0, 10);
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
    { label: 'Active Tasks', value: activeTasks, icon: CheckSquare, iconColor: colors.primary, link: '/work/tasks' },
    { label: 'This Week', value: tasks.length, icon: Calendar, iconColor: colors.signal, link: '/work/schedule' },
    { label: 'Properties', value: 4, icon: Building2, iconColor: colors.accent, link: '/manage/properties' },
    { label: 'Urgent', value: urgentTasks, icon: AlertCircle, iconColor: colors.danger, link: '/work/tasks' },
  ];

  const recentActivity = [
    { text: 'Task completed: Fire safety inspection', time: '2h ago', color: colors.success },
    { text: 'New task assigned: HVAC maintenance', time: '5h ago', color: colors.signal },
    { text: 'Property updated: 123 Main St', time: '1d ago', color: colors.accent },
  ];

  const upcomingReminders = [
    { title: 'Monthly inspection due', property: 'Oak Plaza', time: 'Tomorrow 9:00 AM' },
    { title: 'Vendor meeting scheduled', property: 'Main Street', time: 'Wed 2:00 PM' },
  ];

  return (
    <div 
      className="min-h-screen pb-20"
      style={{ backgroundColor: colors.background }}
    >
      <ContextHeader 
        title="Home" 
        subtitle="Your workspace overview" 
        showSearch={false}
      />

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
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
              className="p-4 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ 
                backgroundColor: colors.surface,
                boxShadow: shadows.outset 
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: colors.background,
                    boxShadow: shadows.inset 
                  }}
                >
                  <stat.icon className="h-5 w-5" style={{ color: stat.iconColor }} />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: colors.ink }}>
                {stat.value}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                {stat.label}
              </div>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: colors.ink }}>
              Recent Activity
            </h2>
          </div>
          <div 
            className="rounded-lg p-4"
            style={{ 
              backgroundColor: colors.surface,
              boxShadow: shadows.outset 
            }}
          >
            <div className="space-y-4">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div 
                    className="w-2 h-2 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p 
                      className="text-sm leading-relaxed"
                      style={{ color: colors.ink }}
                    >
                      {item.text}
                    </p>
                  </div>
                  <span 
                    className="text-xs shrink-0"
                    style={{ color: colors.textLight }}
                  >
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
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: colors.ink }}>
              Upcoming
            </h2>
            <Badge variant="primary">{upcomingReminders.length}</Badge>
          </div>
          <div className="space-y-3">
            {upcomingReminders.map((reminder, idx) => (
              <div
                key={idx}
                className="rounded-lg p-4"
                style={{ 
                  backgroundColor: colors.surface,
                  boxShadow: shadows.outset 
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg shrink-0"
                    style={{ 
                      backgroundColor: colors.background,
                      boxShadow: shadows.inset 
                    }}
                  >
                    <Clock className="h-4 w-4" style={{ color: colors.primary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p 
                      className="text-sm font-semibold mb-0.5"
                      style={{ color: colors.ink }}
                    >
                      {reminder.title}
                    </p>
                    <p 
                      className="text-xs mb-1"
                      style={{ color: colors.textMuted }}
                    >
                      {reminder.property}
                    </p>
                    <div className="flex items-center gap-1">
                      <div 
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: colors.signal }}
                      />
                      <span 
                        className="text-xs font-medium"
                        style={{ color: colors.textLight }}
                      >
                        {reminder.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FloatingAddButton />
      <BottomNav />
    </div>
  );
};

export default Home;
