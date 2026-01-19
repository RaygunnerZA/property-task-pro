import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getSession, subscribeToSession } from "@/lib/sessionManager";

interface Organisation {
  id: string;
  name: string;
  slug: string | null;
  billing_email: string | null;
  created_at: string;
  created_by: string | null;
}

interface DataContextValue {
  // Auth state
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  
  // Organisation state
  orgId: string | null;
  organisation: Organisation | null;
  
  // Identity flags
  userId: string | null;
  isOrgUser: boolean;
  contractorToken: string | null;
  isContractor: boolean;
  
  // Loading/error states
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  clearError: () => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useDataContext must be used within DataProvider");
  }
  return context;
}

// Thin wrapper hooks for convenience
export function useAuth() {
  const { session, user, isAuthenticated, loading } = useDataContext();
  return { session, user, isAuthenticated, loading };
}

export function useOrg() {
  const { orgId, organisation, loading } = useDataContext();
  return { orgId, organisation, loading };
}

export function useCurrentUser() {
  const { user, userId, loading } = useDataContext();
  return { user, userId, loading };
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived values
  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const isAuthenticated = !!session;
  
  // Get org_id from JWT claims (set by Supabase trigger or updateUser)
  const orgId = session?.user?.app_metadata?.org_id || 
                session?.user?.user_metadata?.org_id || 
                null;
  
  // Contractor token from JWT claims
  const contractorToken = session?.user?.app_metadata?.contractor_token || null;
  const isOrgUser = !!orgId && !!userId;
  const isContractor = !!contractorToken && !orgId;

  // Fetch organisation details when orgId changes
  const fetchOrganisation = useCallback(async (id: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        // 406 (Not Acceptable) / PGRST116 errors are expected when user isn't a member yet
        // This is common during invitation acceptance flow
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('0 rows')) {
          console.debug('Cannot fetch organisation - user not yet a member (expected during invitation acceptance):', fetchError);
        } else {
          console.error('Failed to fetch organisation:', fetchError);
        }
        return null;
      }
      return data as Organisation;
    } catch (err) {
      console.error('Error fetching organisation:', err);
      return null;
    }
  }, []);

  // Main refresh function - reads session only (no refreshSession)
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const newSession = await getSession();
      setSession(newSession);
      
      // If we have an org_id in claims, fetch the organisation
      const newOrgId = newSession?.user?.app_metadata?.org_id || 
                       newSession?.user?.user_metadata?.org_id;
      
      if (newOrgId) {
        const org = await fetchOrganisation(newOrgId);
        setOrganisation(org);
      } else {
        setOrganisation(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh session');
    } finally {
      setLoading(false);
    }
  }, [fetchOrganisation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize on mount - read existing session (no refreshSession)
  useEffect(() => {
    let mounted = true;

    getSession().then((initialSession) => {
      if (!mounted) return;
      setSession(initialSession);

      const initialOrgId =
        initialSession?.user?.app_metadata?.org_id ||
        initialSession?.user?.user_metadata?.org_id;

      if (initialOrgId) {
        fetchOrganisation(initialOrgId).then((org) => {
          if (!mounted) return;
          setOrganisation(org);
        });
      }

      setLoading(false);
    });

    const unsubscribe = subscribeToSession((newSession) => {
      // Only synchronous state updates here
      setSession(newSession);

      const newOrgId =
        newSession?.user?.app_metadata?.org_id ||
        newSession?.user?.user_metadata?.org_id;

      if (newOrgId) {
        // Defer DB call to avoid re-entrancy issues
        setTimeout(() => {
          fetchOrganisation(newOrgId).then(setOrganisation);
        }, 0);
      } else {
        setOrganisation(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [fetchOrganisation]);

  // Memoize context value to prevent unnecessary re-renders of all consumers
  // Only recreate when dependencies actually change
  const value: DataContextValue = useMemo(() => ({
    session,
    user,
    isAuthenticated,
    orgId,
    organisation,
    userId,
    isOrgUser,
    contractorToken,
    isContractor,
    loading,
    error,
    refresh,
    clearError,
  }), [
    session,
    user,
    isAuthenticated,
    orgId,
    organisation,
    userId,
    isOrgUser,
    contractorToken,
    isContractor,
    loading,
    error,
    refresh,
    clearError,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export default DataContext;
