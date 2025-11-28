import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heading, Button } from '@/components/filla';
import { BottomNav } from '@/components/BottomNav';
import { PropertyTaskCard } from '@/components/tasks/PropertyTaskCard';
import { TaskListSectionHeader } from '@/components/tasks/TaskListSectionHeader';
import { usePropertyTasks } from '@/hooks/usePropertyTasks';
import { ArrowLeft, Plus } from 'lucide-react';

export default function PropertyTasks() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tasks, loading, property } = usePropertyTasks(id!);

  const groupedTasks = {
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in-progress'),
    completed: tasks.filter(t => t.status === 'completed')
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/properties')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <Heading variant="xl">Property Tasks</Heading>
            {property && (
              <p className="text-muted-foreground text-sm mt-1">{property.address}</p>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/add-task?propertyId=${id}`)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedTasks.pending.length > 0 && (
              <div>
                <TaskListSectionHeader title="Pending" count={groupedTasks.pending.length} />
                <div className="space-y-3 mt-4">
                  {groupedTasks.pending.map(task => (
                    <PropertyTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.inProgress.length > 0 && (
              <div>
                <TaskListSectionHeader title="In Progress" count={groupedTasks.inProgress.length} />
                <div className="space-y-3 mt-4">
                  {groupedTasks.inProgress.map(task => (
                    <PropertyTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.completed.length > 0 && (
              <div>
                <TaskListSectionHeader title="Completed" count={groupedTasks.completed.length} />
                <div className="space-y-3 mt-4">
                  {groupedTasks.completed.map(task => (
                    <PropertyTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No tasks for this property yet</p>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/add-task?propertyId=${id}`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Task
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
