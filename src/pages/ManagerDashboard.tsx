/**
 * MANAGER DASHBOARD
 * - MiniCalendar at top with task/compliance markers
 * - Tabbed section: Tasks | Inbox
 * - Quick stats overview
 * - Filla neomorphic paper aesthetic
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextHeader } from '@/components/ContextHeader';
import { BottomNav } from '@/components/BottomNav';
import { MiniCalendar, type CalendarEvent } from '@/components/filla/MiniCalendar';
import { SegmentedControl } from '@/components/filla/SegmentedControl';
import { colors, shadows } from '@/components/filla';
import { useTasks } from '@/hooks/useTasks';
import { useMessages } from '@/hooks/useMessages';
import { 
  CheckSquare, 
  Inbox, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  Building2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'tasks' | 'inbox';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  
  const { tasks } = useTasks();
  const { messages } = useMessages();

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
  const selectedISO = selectedDate.toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);
  
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const overdueTasks = activeTasks.filter(t => t.due_at && t.due_at.slice(0, 10) < todayISO);
  const todayTasks = activeTasks.filter(t => t.due_at?.slice(0, 10) === todayISO);
  const selectedDateTasks = activeTasks.filter(t => t.due_at?.slice(0, 10) === selectedISO);

  const stats = [
    { 
      label: 'Active', 
      value: activeTasks.length, 
      icon: CheckSquare, 
      color: colors.primary 
    },
    { 
      label: 'Today', 
      value: todayTasks.length, 
      icon: Clock, 
      color: colors.signal 
    },
    { 
      label: 'Overdue', 
      value: overdueTasks.length, 
      icon: AlertTriangle, 
      color: colors.danger 
    },
    { 
      label: 'Inbox', 
      value: messages.length, 
      icon: Inbox, 
      color: colors.accent 
    },
  ];

  const tabOptions = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'inbox', label: 'Inbox' },
  ];

  const handleTaskPress = (taskId: string) => {
    navigate(`/task/${taskId}`);
  };

  return (
    <div className="pb-20 md:pb-6">
      <ContextHeader 
        title="Dashboard" 
        subtitle="Manager overview"
      />

      <div className="max-w-md mx-auto px-4 py-4 space-y-5">
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

        {/* MiniCalendar */}
        <MiniCalendar
          selectedDate={selectedDate}
          events={calendarEvents}
          onSelect={(date) => setSelectedDate(date)}
          showMonthNav={true}
        />

        {/* Tab Control */}
        <div className="flex justify-center">
          <SegmentedControl
            options={tabOptions}
            selectedId={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
          />
        </div>

        {/* Tab Content */}
        <div 
          className="rounded-xl p-4"
          style={{ 
            backgroundColor: colors.surface,
            boxShadow: shadows.outset 
          }}
        >
          {activeTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 
                  className="text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  {selectedISO === todayISO ? "Today's Tasks" : `Tasks for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </h3>
                <span 
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ 
                    backgroundColor: colors.background,
                    color: colors.textMuted 
                  }}
                >
                  {selectedDateTasks.length}
                </span>
              </div>

              {selectedDateTasks.length === 0 ? (
                <p 
                  className="text-sm text-center py-6"
                  style={{ color: colors.textLight }}
                >
                  No tasks for this day
                </p>
              ) : (
                selectedDateTasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskPress(task.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ 
                      backgroundColor: colors.background,
                      boxShadow: shadows.inset 
                    }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ 
                        backgroundColor: task.priority === 'high' 
                          ? colors.danger 
                          : task.priority === 'low' 
                            ? colors.textLight 
                            : colors.primary 
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p 
                        className="text-sm font-medium truncate"
                        style={{ color: colors.ink }}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p 
                          className="text-xs truncate mt-0.5"
                          style={{ color: colors.textMuted }}
                        >
                          {task.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight 
                      className="h-4 w-4 shrink-0" 
                      style={{ color: colors.textLight }} 
                    />
                  </button>
                ))
              )}

              {selectedDateTasks.length > 5 && (
                <button
                  onClick={() => navigate('/work/tasks')}
                  className="w-full text-center text-sm font-medium py-2"
                  style={{ color: colors.primary }}
                >
                  View all {selectedDateTasks.length} tasks →
                </button>
              )}
            </div>
          )}

          {activeTab === 'inbox' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 
                  className="text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  Recent Messages
                </h3>
                <span 
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ 
                    backgroundColor: colors.background,
                    color: colors.textMuted 
                  }}
                >
                  {messages.length}
                </span>
              </div>

              {messages.length === 0 ? (
                <p 
                  className="text-sm text-center py-6"
                  style={{ color: colors.textLight }}
                >
                  No messages yet
                </p>
              ) : (
                messages.slice(0, 5).map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-lg"
                    style={{ 
                      backgroundColor: colors.background,
                      boxShadow: shadows.inset 
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ 
                          backgroundColor: colors.primary,
                          color: '#fff' 
                        }}
                      >
                        {msg.author_name?.slice(0, 2).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-sm font-medium"
                          style={{ color: colors.ink }}
                        >
                          {msg.author_name || 'Unknown'}
                        </p>
                        <p 
                          className="text-xs truncate mt-0.5"
                          style={{ color: colors.textMuted }}
                        >
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {messages.length > 5 && (
                <button
                  onClick={() => navigate('/work/inbox')}
                  className="w-full text-center text-sm font-medium py-2"
                  style={{ color: colors.primary }}
                >
                  View all messages →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/add-task')}
            className="p-4 rounded-xl text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: colors.primary,
              boxShadow: shadows.outset 
            }}
          >
            <CheckSquare className="h-5 w-5 mx-auto mb-1 text-white" />
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
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ManagerDashboard;
