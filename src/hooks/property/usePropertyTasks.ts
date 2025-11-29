// Frontend-only placeholder hook for property tasks summary
import { useState } from 'react';

export interface PropertyTasksSummary {
  activeTasks: number;
  overdueTasks: number;
  completedThisMonth: number;
}

export const usePropertyTasks = (propertyId: string) => {
  const [tasksSummary] = useState<PropertyTasksSummary>({
    activeTasks: 3,
    overdueTasks: 1,
    completedThisMonth: 8
  });

  return { tasksSummary, isLoading: false };
};
