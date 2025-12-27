import { useState } from 'react';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { SegmentControl, SegmentOption } from '@/components/filla';
import WorkTasks from '@/components/work/WorkTasks';
import WorkMessages from '@/components/work/WorkMessages';
import WorkReminders from '@/components/work/WorkReminders';
import { StandardPage } from '@/components/design-system/StandardPage';
import { Briefcase } from 'lucide-react';

const Work = () => {
  const [activeTab, setActiveTab] = useState('tasks');

  const tabs: SegmentOption[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'messages', label: 'Messages' },
    { id: 'reminders', label: 'Reminders' },
  ];

  return (
    <StandardPage
      title="Work"
      subtitle="Manage your workflow"
      icon={<Briefcase className="h-6 w-6" />}
      maxWidth="md"
    >
      <div className="space-y-4">
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
    </StandardPage>
  );
};

export default Work;
