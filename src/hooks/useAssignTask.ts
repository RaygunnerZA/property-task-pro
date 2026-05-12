import { useState } from 'react';

interface AssignTaskParams {
  taskId: string;
  userId?: string;
  teamId?: string;
}

export function useAssignTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const assign = async (params: AssignTaskParams) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Connect to backend service
      void params;
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { assign, loading, error };
}
