import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { ContextHeader } from '@/components/ContextHeader';
import { SegmentControl, SegmentOption, colors } from '@/components/filla';
import WorkTasks from '@/components/work/WorkTasks';
import WorkMessages from '@/components/work/WorkMessages';
import WorkReminders from '@/components/work/WorkReminders';

const Work = () => {
  const [activeTab, setActiveTab] = useState('tasks');

  const tabs: SegmentOption[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'messages', label: 'Messages' },
    { id: 'reminders', label: 'Reminders' },
  ];

  return (
    <div 
      className="min-h-screen pb-20"
      style={{ backgroundColor: colors.background }}
    >
      <ContextHeader 
        title="Work" 
        subtitle="Manage your workflow" 
      />

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <SegmentControl 
          options={tabs}
          selectedId={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-4">
          {activeTab === 'tasks' && <WorkTasks />}
          {activeTab === 'messages' && <WorkMessages />}
          {activeTab === 'reminders' && <WorkReminders />}
        </div>
      </div>

      <FloatingAddButton />
      <BottomNav />
    </div>
  );
};

export default Work;
