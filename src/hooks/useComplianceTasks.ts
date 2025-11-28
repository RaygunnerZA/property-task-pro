import { useState, useEffect } from 'react';

interface ComplianceTask {
  id: string;
  title: string;
  description?: string;
  propertyName: string;
  ruleName: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue: boolean;
  isDueToday: boolean;
  slaStatus: 'on-track' | 'at-risk' | 'breached';
}

export function useComplianceTasks() {
  const [data, setData] = useState<ComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Connect to backend service
    // This is a stub that returns empty data
    setLoading(false);
    setData([]);
  }, []);

  return { data, loading };
}
