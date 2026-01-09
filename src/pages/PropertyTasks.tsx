import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PropertyTaskCard } from '@/components/tasks/PropertyTaskCard';
import { TaskListSectionHeader } from '@/components/tasks/TaskListSectionHeader';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { usePropertyTasks } from '@/hooks/usePropertyTasks';
import { Plus, CheckSquare } from 'lucide-react';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';

export default function PropertyTasks() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tasks, loading, property } = usePropertyTasks(id!);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const groupedTasks = {
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in-progress'),
    completed: tasks.filter(t => t.status === 'completed')
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  return (
    <StandardPageWithBack
      title="Property Tasks"
      subtitle={property?.address}
      backTo="/properties"
      icon={<CheckSquare className="h-6 w-6" />}
      action={
        <NeomorphicButton size="sm" onClick={() => navigate(`/add-task?propertyId=${id}`)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </NeomorphicButton>
      }
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading tasks..." />
      ) : (
          <div className="space-y-8">
            {groupedTasks.pending.length > 0 && (
              <div>
                <TaskListSectionHeader title="Pending" count={groupedTasks.pending.length} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {groupedTasks.pending.map(task => (
                    <PropertyTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.inProgress.length > 0 && (
              <div>
                <TaskListSectionHeader title="In Progress" count={groupedTasks.inProgress.length} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {groupedTasks.inProgress.map(task => (
                    <PropertyTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.completed.length > 0 && (
              <div>
                <TaskListSectionHeader title="Completed" count={groupedTasks.completed.length} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {groupedTasks.completed.map(task => (
                    <PropertyTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <EmptyState
                icon={CheckSquare}
                title="No tasks for this property yet"
                description="Create your first task to get started"
                action={{
                  label: "Create First Task",
                  onClick: () => navigate(`/add-task?propertyId=${id}`),
                  icon: Plus
                }}
              />
            )}
          </div>
        )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </StandardPageWithBack>
  );
}
