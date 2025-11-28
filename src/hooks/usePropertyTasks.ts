import { useState, useEffect } from 'react';

interface PropertyTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue?: boolean;
}

interface Property {
  id: string;
  address: string;
  nickname?: string;
}

export function usePropertyTasks(propertyId: string) {
  const [data, setData] = useState<PropertyTask[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Connect to backend service
    // This is a stub that returns empty data
    setLoading(false);
    setData([]);
    setProperty(null);
  }, [propertyId]);

  return { data, property, loading };
}
