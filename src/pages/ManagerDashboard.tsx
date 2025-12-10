/**
 * MANAGER DASHBOARD
 * - Two-column layout: Calendar (left) | DashboardTabs (right)
 * - Quick stats overview
 * - Uses standardized filla components
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextHeader } from '@/components/ContextHeader';
import { BottomNav } from '@/components/BottomNav';
import { 
  MiniCalendar, 
  DashboardTabs,
  type CalendarEvent,
  type TaskCardProps,
  type InboxItem,
  type ReminderItem,
  colors, 
  shadows 
} from '@/components/filla';
import { useTasks } from '@/hooks/useTasks';
import { useMessages } from '@/hooks/useMessages';
import { useReminders } from '@/hooks/useReminders';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { 
  CheckSquare, 
  Inbox, 
  AlertTriangle, 
  Clock, 
  Building2,
  Plus 
} from 'lucide-react';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateTask, setShowCreateTask] = useState(false);
  
  const { tasks, refresh: refreshTasks } = useTasks();
  const { messages } = useMessages();
  const { reminders } = useReminders();

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
        priority: (t.priority === 'high' || t.priority === 'urgent' ? 'high' : t.priority === 'low' ? 'low' : 'normal') as 'low' | 'normal' | 'high',
      })),
      compliance: [],
    }));
  }, [tasks]);

  // Stats derived from real data
  const selectedISO = selectedDate.toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);
  
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const overdueTasks = activeTasks.filter(t => t.due_at && t.due_at.slice(0, 10) < todayISO);
  const todayTasks = activeTasks.filter(t => t.due_at?.slice(0, 10) === todayISO);
  const selectedDateTasks = activeTasks.filter(t => t.due_at?.slice(0, 10) === selectedISO);

  const stats = [
    { label: 'Active', value: activeTasks.length, icon: CheckSquare, color: colors.primary },
    { label: 'Today', value: todayTasks.length, icon: Clock, color: colors.signal },
    { label: 'Overdue', value: overdueTasks.length, icon: AlertTriangle, color: colors.danger },
    { label: 'Inbox', value: messages.length, icon: Inbox, color: colors.accent },
  ];

  // Transform tasks to TaskCardProps format
  const taskCards: TaskCardProps[] = useMemo(() => {
    return selectedDateTasks.slice(0, 5).map((task) => ({
      title: task.title,
      description: task.description || undefined,
      priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
      dueDate: task.due_at 
        ? new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : undefined,
      imageUrl: task.primary_image_url || undefined,
      showAlert: task.priority === 'urgent' || task.priority === 'high',
    }));
  }, [selectedDateTasks]);

  // Transform messages to InboxItem format
  const inboxItems: InboxItem[] = useMemo(() => {
    return messages.slice(0, 5).map((msg) => ({
      id: msg.id,
      type: (msg.source === 'whatsapp' ? 'whatsapp' : msg.source === 'email' ? 'email' : 'comment') as InboxItem['type'],
      from: msg.author_name || 'Unknown',
      message: msg.body,
      time: new Date(msg.created_at || '').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    }));
  }, [messages]);

  // Transform reminders to ReminderItem format
  const reminderItems: ReminderItem[] = useMemo(() => {
    return reminders.slice(0, 5).map((r) => {
      const daysUntil = r.due_at 
        ? Math.ceil((new Date(r.due_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: r.id,
        title: r.title,
        property: 'All properties',
        due: daysUntil !== null ? (daysUntil > 0 ? `In ${daysUntil} days` : 'Overdue') : 'No date',
        type: (r.type === 'compliance' ? 'compliance' : 'schedule') as ReminderItem['type'],
      };
    });
  }, [reminders]);

  const handleTaskClick = (index: number) => {
    const task = selectedDateTasks[index];
    if (task) navigate(`/task/${task.id}`);
  };

  return (
    <div className="pb-20 md:pb-6">
      <ContextHeader 
        title="Dashboard" 
        subtitle="Manager overview"
      />

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-xl text-center"
              style={{ 
                backgroundColor: colors.surface,
                boxShadow: shadows.outset 
              }}
            >
              <stat.icon 
                className="h-4 w-4 mx-auto mb-1" 
                style={{ color: stat.color }} 
              />
              <div 
                className="text-xl font-bold font-mono"
                style={{ color: colors.ink }}
              >
                {stat.value}
              </div>
              <div 
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.textMuted }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Two-Column Layout: Calendar (left) | DashboardTabs (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Calendar */}
          <div>
            <MiniCalendar
              selectedDate={selectedDate}
              events={calendarEvents}
              onSelect={(date) => setSelectedDate(date)}
              showMonthNav={true}
            />
          </div>

          {/* Right Column: Standardized DashboardTabs */}
          <div>
            <DashboardTabs
              tasks={taskCards}
              inbox={inboxItems}
              reminders={reminderItems}
              onTaskClick={handleTaskClick}
              showReminders={true}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto lg:max-w-none lg:grid-cols-4">
          <button
            onClick={() => setShowCreateTask(true)}
            className="p-4 rounded-xl text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: colors.primary,
              boxShadow: shadows.outset 
            }}
          >
            <Plus className="h-5 w-5 mx-auto mb-1 text-white" />
            <span className="text-sm font-semibold text-white">Add Task</span>
          </button>
          <button
            onClick={() => navigate('/manage/properties')}
            className="p-4 rounded-xl text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: colors.surface,
              boxShadow: shadows.outset 
            }}
          >
            <Building2 className="h-5 w-5 mx-auto mb-1" style={{ color: colors.accent }} />
            <span className="text-sm font-semibold" style={{ color: colors.ink }}>Properties</span>
          </button>
          <button
            onClick={() => navigate('/work/tasks')}
            className="p-4 rounded-xl text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: colors.surface,
              boxShadow: shadows.outset 
            }}
          >
            <CheckSquare className="h-5 w-5 mx-auto mb-1" style={{ color: colors.primary }} />
            <span className="text-sm font-semibold" style={{ color: colors.ink }}>All Tasks</span>
          </button>
          <button
            onClick={() => navigate('/work/inbox')}
            className="p-4 rounded-xl text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: colors.surface,
              boxShadow: shadows.outset 
            }}
          >
            <Inbox className="h-5 w-5 mx-auto mb-1" style={{ color: colors.signal }} />
            <span className="text-sm font-semibold" style={{ color: colors.ink }}>Inbox</span>
          </button>
        </div>
      </div>

      <BottomNav />
      
      {/* Create Task Modal */}
      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        defaultDueDate={selectedDate.toISOString().slice(0, 10)}
        onTaskCreated={() => {
          refreshTasks();
          setShowCreateTask(false);
        }}
      />
    </div>
  );
};

export default ManagerDashboard;
