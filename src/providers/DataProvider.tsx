import { createContext, useContext, ReactNode } from "react";
import { useSession } from "@/hooks/useSession";
import { useFillaIdentity } from "@/hooks/useFillaIdentity";
import { Skeleton } from "@/components/ui/skeleton";

interface DataContextValue {
  orgId: string | null;
  userId: string | null;
  contractorToken: string | null;
  isOrgUser: boolean;
  isContractor: boolean;
  isAuthenticated: boolean;
  loading: boolean;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useDataContext must be used within DataProvider");
  }
  return context;
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { session, loading: sessionLoading } = useSession();
  const { orgId, userId, contractorToken, isOrgUser, isContractor } = useFillaIdentity();

  const isAuthenticated = !!session;
  const loading = sessionLoading;

  const value: DataContextValue = {
    orgId,
    userId,
    contractorToken,
    isOrgUser,
    isContractor,
    isAuthenticated,
    loading,
  };

  if (loading) {
    return <DataProviderSkeleton />;
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function DataProviderSkeleton() {
  return (
    <div className="min-h-screen bg-[#F6F4F2] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <Skeleton className="h-16 w-16 rounded-3xl mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>
      </div>
    </div>
  );
}
