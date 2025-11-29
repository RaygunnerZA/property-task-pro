import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { ContextHeader } from '@/components/ContextHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WorkTasks from '@/components/work/WorkTasks';
import WorkMessages from '@/components/work/WorkMessages';
import WorkReminders from '@/components/work/WorkReminders';

const Work = () => {
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <div className="min-h-screen bg-paper pb-20">
      <ContextHeader title="Work" subtitle="Manage your workflow" />

      <div className="max-w-md mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-0">
            <WorkTasks />
          </TabsContent>

          <TabsContent value="messages" className="mt-0">
            <WorkMessages />
          </TabsContent>

          <TabsContent value="reminders" className="mt-0">
            <WorkReminders />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingAddButton />
      <BottomNav />
    </div>
  );
};

export default Work;
