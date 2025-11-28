import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedUser?: {
    id: string;
    name: string;
  };
  assignedTeam?: {
    id: string;
    name: string;
  };
  propertyId?: string;
  propertyName?: string;
  ruleId?: string;
  ruleName?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export function useTask(taskId: string) {
  const [data, setData] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // TODO: Connect to backend service
    // This is a stub that returns null
    setLoading(false);
    setData(null);
  }, [taskId]);

  return { data, loading, error };
}
