import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComplianceTaskCard } from '@/components/tasks/ComplianceTaskCard';
import { TaskListSectionHeader } from '@/components/tasks/TaskListSectionHeader';
import { useComplianceTasks } from '@/hooks/useComplianceTasks';
import { SegmentedControl } from '@/components/filla/SegmentedControl';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Shield, CheckSquare } from 'lucide-react';

export default function ComplianceTasks() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const { data: tasks, loading } = useComplianceTasks();

  const filteredTasks = tasks.filter(task => 
    filter === 'all' ? true : task.status === filter
  );

  const groupedTasks = {
    overdue: filteredTasks.filter(t => t.isOverdue),
    today: filteredTasks.filter(t => t.isDueToday && !t.isOverdue),
    upcoming: filteredTasks.filter(t => !t.isDueToday && !t.isOverdue)
  };

  return (
    <StandardPage
      title="Compliance Tasks"
      icon={<Shield className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="mb-6">
        <SegmentedControl
          selectedId={filter}
          onChange={(id) => setFilter(id as typeof filter)}
          options={[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'in-progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' }
          ]}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading tasks..." />
      ) : (
          <div className="space-y-8">
            {groupedTasks.overdue.length > 0 && (
              <div>
                <TaskListSectionHeader title="Overdue" count={groupedTasks.overdue.length} variant="danger" />
                <div className="space-y-3 mt-4">
                  {groupedTasks.overdue.map(task => (
                    <ComplianceTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.today.length > 0 && (
              <div>
                <TaskListSectionHeader title="Due Today" count={groupedTasks.today.length} variant="warning" />
                <div className="space-y-3 mt-4">
                  {groupedTasks.today.map(task => (
                    <ComplianceTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.upcoming.length > 0 && (
              <div>
                <TaskListSectionHeader title="Upcoming" count={groupedTasks.upcoming.length} />
                <div className="space-y-3 mt-4">
                  {groupedTasks.upcoming.map(task => (
                    <ComplianceTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <EmptyState
                icon={CheckSquare}
                title="No tasks found"
                description="No compliance tasks match your filter"
              />
            )}
          </div>
        )}
    </StandardPage>
  );
}
