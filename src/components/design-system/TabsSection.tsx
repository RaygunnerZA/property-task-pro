import React, { useState } from 'react';
import { CheckSquare, Inbox, Bell, Clock, AlertTriangle, MessageSquare, Mail, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'reminders', label: 'Reminders', icon: Bell }
];

const filters = ['All', 'Today', 'This Week', 'High Priority', 'Overdue'];

const mockTasks = [
  { id: 1, title: 'Replace fire extinguisher', property: 'Block A', priority: 'high', due: 'Today' },
  { id: 2, title: 'Fix leaking tap in Unit 4', property: 'Oak House', priority: 'normal', due: 'Tomorrow' },
  { id: 3, title: 'Annual gas safety check', property: 'Maple Court', priority: 'high', due: 'Overdue' }
];

const mockInbox = [
  { id: 1, type: 'whatsapp', from: 'John (Tenant)', message: 'Hi, the heating still isn\'t working properly', time: '10:32 AM' },
  { id: 2, type: 'email', from: 'jane@contractor.com', message: 'Invoice attached for boiler repair', time: '9:15 AM' },
  { id: 3, type: 'comment', from: 'Sarah M.', message: 'Completed inspection, photos uploaded', time: 'Yesterday' }
];

const mockReminders = [
  { id: 1, title: 'Gas certificate expires', property: 'All properties', due: 'In 30 days', type: 'compliance' },
  { id: 2, title: 'Quarterly inspection due', property: 'Oak House', due: 'In 7 days', type: 'schedule' },
  { id: 3, title: 'Insurance renewal', property: 'Block A', due: 'In 14 days', type: 'compliance' }
];

function TasksTab() {
  const [selectedFilter, setSelectedFilter] = useState('All');
  return (
    <div className="space-y-4">
      {/* Filter Chips - Standardized with 5px radius and E1 shadow */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={cn(
              'px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider whitespace-nowrap transition-all shadow-e1',
              selectedFilter === filter
                ? 'bg-primary text-white'
                : 'bg-concrete/50 text-ink/70 hover:bg-concrete'
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Task List - Mini cards with card-flat and hover height shift */}
      <div className="space-y-3">
        {mockTasks.map(task => (
          <div
            key={task.id}
            className="card-flat p-4 flex items-center gap-4 rounded-[5px] hover:translate-y-[-2px] transition-transform cursor-pointer"
          >
            <div className={cn('w-1 h-12 rounded-full', task.priority === 'high' ? 'bg-accent' : 'bg-primary')} />
            <div className="flex-1">
              <h4 className="font-semibold text-ink text-sm">{task.title}</h4>
              <p className="text-xs text-muted-foreground">{task.property}</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={cn(
                'font-mono text-[10px] uppercase tracking-wider',
                task.due === 'Overdue' ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {task.due}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InboxTab() {
  const getIcon = (type: string) => {
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
  };

  return (
    <div className="space-y-3">
      {mockInbox.map(item => (
        <div
          key={item.id}
          className="card-flat p-4 flex items-start gap-3 rounded-[5px] hover:translate-y-[-2px] transition-transform cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-concrete/50 flex items-center justify-center flex-shrink-0">
            {getIcon(item.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-ink truncate">{item.from}</span>
              <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RemindersTab() {
  return (
    <div className="space-y-3">
      {mockReminders.map(reminder => (
        <div
          key={reminder.id}
          className="card-flat p-4 flex items-center gap-4 rounded-[5px] hover:translate-y-[-2px] transition-transform cursor-pointer"
        >
          <div className={cn(
            'w-10 h-10 rounded-[5px] flex items-center justify-center',
            reminder.type === 'compliance' ? 'bg-warning/30' : 'bg-primary/10'
          )}>
            {reminder.type === 'compliance' 
              ? <AlertTriangle className="w-5 h-5 text-amber-600" /> 
              : <Bell className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-ink text-sm">{reminder.title}</h4>
            <p className="text-xs text-muted-foreground">{reminder.property}</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {reminder.due}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TabsSection() {
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Tabs Component</h2>
        <p className="text-muted-foreground text-sm">Segment control tabs with card-flat mini cards</p>
      </div>

      <div className="rounded-[5px] shadow-e2 overflow-hidden max-w-xl bg-section-flat">
        {/* Segment Control - Using card-section background */}
        <div className="p-2 bg-section-flat">
          <div className="flex rounded-[5px] p-1 bg-concrete/30">
            {tabs.map(tab => {
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
                  style={isActive ? {
                    boxShadow: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)'
                  } : undefined}
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
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'inbox' && <InboxTab />}
          {activeTab === 'reminders' && <RemindersTab />}
        </div>
      </div>
    </section>
  );
}
