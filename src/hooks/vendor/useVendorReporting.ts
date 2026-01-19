import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

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

interface VendorReportingData {
  performance: VendorPerformance;
  sla: VendorSLA;
  completion: Array<{ date: string; completed: number }>;
  drift: VendorDrift;
}

/**
 * Hook to fetch vendor reporting data.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @returns Reporting data and loading state
 */
export const useVendorReporting = () => {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.vendorReporting(),
    queryFn: async (): Promise<VendorReportingData> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return {
        performance: { 
          score: 87, 
          onTime: 92 
        },
        sla: { 
          within: 45, 
          late: 6, 
          critical: 1 
        },
        completion: [
          { date: '2024-01-01', completed: 8 },
          { date: '2024-01-08', completed: 12 },
          { date: '2024-01-15', completed: 10 },
          { date: '2024-01-22', completed: 15 }
        ],
        drift: { 
          resolved: 12, 
          avgTime: 2.4 
        }
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 0, // Don't retry mock implementation
  });

  return {
    performance: data?.performance || { score: 0, onTime: 0 },
    sla: data?.sla || { within: 0, late: 0, critical: 0 },
    completion: data?.completion || [],
    drift: data?.drift || { resolved: 0, avgTime: 0 },
    isLoading
  };
};
