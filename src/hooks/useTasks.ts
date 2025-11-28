import { useEffect, useState } from 'react';
import { tasksService } from '../services/tasks/tasks';

export function useTasks(orgId: string) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    tasksService.getTasks(orgId).then(({ data, error }) => {
      setTasks(data ?? []);
      setError(error);
      setLoading(false);
    });
  }, [orgId]);

  return { tasks, loading, error };
}
