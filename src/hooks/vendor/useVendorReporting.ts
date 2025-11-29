import { useState, useEffect } from 'react';

export interface VendorPerformance {
  score: number;
  onTime: number;
}

export interface VendorSLA {
  within: number;
  late: number;
  critical: number;
}

export interface VendorDrift {
  resolved: number;
  avgTime: number;
}

/**
 * Stub hook for vendor reporting data
 * Returns placeholder performance metrics
 */
export const useVendorReporting = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  const performance: VendorPerformance = { 
    score: 87, 
    onTime: 92 
  };

  const sla: VendorSLA = { 
    within: 45, 
    late: 6, 
    critical: 1 
  };

  const completion = [
    { date: '2024-01-01', completed: 8 },
    { date: '2024-01-08', completed: 12 },
    { date: '2024-01-15', completed: 10 },
    { date: '2024-01-22', completed: 15 }
  ];

  const drift: VendorDrift = { 
    resolved: 12, 
    avgTime: 2.4 
  };

  return {
    performance,
    sla,
    completion,
    drift,
    isLoading
  };
};
