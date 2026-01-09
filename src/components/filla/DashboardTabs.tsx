/**
 * DashboardTabs Component - matches Design Library TabsSection specification
 * Segment control with filter chips and mini card lists
 */
import { useState, ReactNode } from 'react';
import { CheckSquare, Inbox, Bell, Clock, AlertTriangle, MessageSquare, Mail, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCard, TaskCardProps } from './TaskCard';

export interface DashboardTabsProps {
  tasks?: TaskCardProps[];
  inbox?: InboxItem[];
  reminders?: ReminderItem[];
  onTaskClick?: (index: number) => void;
  onInboxClick?: (index: number) => void;
  onReminderClick?: (index: number) => void;
  defaultTab?: 'tasks' | 'inbox' | 'reminders';
  showReminders?: boolean;
}

export interface InboxItem {
  id: string;
  type: 'whatsapp' | 'email' | 'comment' | 'other';
  from: string;
  message: string;
  time: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  property: string;
  due: string;
  type: 'compliance' | 'schedule';
}

const tabs = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'reminders', label: 'Reminders', icon: Bell },
];

const filters = ['All', 'Today', 'This Week', 'High Priority', 'Overdue'];

function InboxIcon({ type }: { type: string }) {
  switch (type) {
    case 'whatsapp':
      return <MessageSquare className="w-4 h-4 text-green-600" />;
    case 'email':
      return <Mail className="w-4 h-4 text-blue-600" />;
    case 'comment':
      return <User className="w-4 h-4 text-primary" />;
    default:
      return <Inbox className="w-4 h-4 text-muted-foreground" />;
  }
}

export function DashboardTabs({
  tasks = [],
  inbox = [],
  reminders = [],
  onTaskClick,
  onInboxClick,
  onReminderClick,
  defaultTab = 'tasks',
  showReminders = true,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [selectedFilter, setSelectedFilter] = useState('All');

  const visibleTabs = showReminders ? tabs : tabs.filter(t => t.id !== 'reminders');

  return (
    <div className="rounded-[5px] shadow-e2 overflow-hidden bg-section-flat">
      {/* Segment Control */}
      <div className="p-2 bg-section-flat">
        <div className="flex rounded-[5px] p-1 bg-concrete/30">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-[5px] transition-all',
                  isActive
                    ? 'bg-card shadow-e1 text-primary'
                    : 'text-muted-foreground hover:text-ink'
                )}
                style={
                  isActive
                    ? {
                        boxShadow:
                          '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)',
                      }
                    : undefined
                }
              >
                <Icon className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-wider font-medium">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {filters.map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={cn(
                    'px-3 py-1.5 rounded-[5px] font-mono text-[13px] uppercase tracking-wider whitespace-nowrap transition-all shadow-e1',
                    selectedFilter === filter
                      ? 'bg-primary text-white'
                      : 'bg-concrete/50 text-ink/70 hover:bg-concrete'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No tasks to display
                </p>
              ) : (
                tasks.map((task, idx) => (
                  <TaskCard
                    key={idx}
                    {...task}
                    onClick={() => onTaskClick?.(idx)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <div className="space-y-3">
            {inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No messages in inbox
              </p>
            ) : (
              inbox.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onInboxClick?.(idx)}
                  className="card-flat p-4 flex items-start gap-3 rounded-[5px] hover:translate-y-[-2px] transition-transform cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-concrete/50 flex items-center justify-center flex-shrink-0">
                    <InboxIcon type={item.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-ink truncate">
                        {item.from}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {item.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No reminders
              </p>
            ) : (
              reminders.map((reminder, idx) => (
                <div
                  key={reminder.id}
                  onClick={() => onReminderClick?.(idx)}
                  className="card-flat p-4 flex items-center gap-4 rounded-[5px] hover:translate-y-[-2px] transition-transform cursor-pointer"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-[5px] flex items-center justify-center',
                      reminder.type === 'compliance' ? 'bg-warning/30' : 'bg-primary/10'
                    )}
                  >
                    {reminder.type === 'compliance' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Bell className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-ink text-sm">{reminder.title}</h4>
                    <p className="text-xs text-muted-foreground">{reminder.property}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {reminder.due}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardTabs;
