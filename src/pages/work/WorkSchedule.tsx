import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surface, Heading, Text } from '@/components/filla';
import TaskCard from '@/components/TaskCard';
import { useTasks } from '@/hooks/useTasks';

type TimeGroup = 'overdue' | 'today' | 'tomorrow' | 'next_7_days' | 'later';

interface GroupedTasks {
  overdue: any[];
  today: any[];
  tomorrow: any[];
  next_7_days: any[];
  later: any[];
}

export default function WorkSchedule() {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();

  const groupTasksByTime = (): GroupedTasks => {
    const grouped: GroupedTasks = {
      overdue: [],
      today: [],
      tomorrow: [],
      next_7_days: [],
      later: [],
    };

    if (!tasks) return grouped;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    tasks.forEach(task => {
      if (!task.due_at) {
        grouped.later.push(task);
        return;
      }

      const dueDate = new Date(task.due_at);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

      if (dueDateOnly < today && task.status !== 'completed') {
        grouped.overdue.push(task);
      } else if (dueDateOnly.getTime() === today.getTime()) {
        grouped.today.push(task);
      } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
        grouped.tomorrow.push(task);
      } else if (dueDateOnly < nextWeek) {
        grouped.next_7_days.push(task);
      } else {
        grouped.later.push(task);
      }
    });

    return grouped;
  };

  const groupedTasks = groupTasksByTime();

  const getGroupLabel = (group: TimeGroup): string => {
    switch (group) {
      case 'overdue': return 'Overdue';
      case 'today': return 'Today';
      case 'tomorrow': return 'Tomorrow';
      case 'next_7_days': return 'Next 7 Days';
      case 'later': return 'Later';
    }
  };

  const getGroupColor = (group: TimeGroup): string => {
    switch (group) {
      case 'overdue': return 'text-red-600';
      case 'today': return 'text-primary';
      default: return 'text-foreground';
    }
  };

  const renderGroup = (group: TimeGroup, tasks: any[]) => {
    if (tasks.length === 0) return null;

    return (
      <div key={group} className="mb-8">
        <Heading variant="m" className={`mb-3 ${getGroupColor(group)}`}>
          {getGroupLabel(group)} ({tasks.length})
        </Heading>
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              property={null}
              onClick={() => navigate(`/task/${task.id}`)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <Heading variant="l" className="mb-2">Schedule</Heading>
        <Text variant="muted">
          Tasks organized by due date
        </Text>
      </div>

      {loading ? (
        <Surface variant="neomorphic" className="p-8 text-center">
          <p className="text-muted-foreground">Loading schedule...</p>
        </Surface>
      ) : (
        <>
          {renderGroup('overdue', groupedTasks.overdue)}
          {renderGroup('today', groupedTasks.today)}
          {renderGroup('tomorrow', groupedTasks.tomorrow)}
          {renderGroup('next_7_days', groupedTasks.next_7_days)}
          {renderGroup('later', groupedTasks.later)}

          {tasks && tasks.length === 0 && (
            <Surface variant="neomorphic" className="p-8 text-center">
              <p className="text-muted-foreground">No tasks scheduled</p>
            </Surface>
          )}
        </>
      )}
    </div>
  );
}
