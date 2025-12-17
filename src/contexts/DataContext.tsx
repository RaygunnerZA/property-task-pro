import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
        console.error('Failed to fetch organisation:', fetchError);
        return null;
      }
      return data as Organisation;
    } catch (err) {
      console.error('Error fetching organisation:', err);
      return null;
    }
  }, []);

  // Main refresh function - uses refreshSession to ensure fresh JWT with org_id claim
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use refreshSession instead of getSession to get fresh JWT with updated claims
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        // If refresh fails, try getSession as fallback (might be a new session)
        const { data: { session: fallbackSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
          setOrganisation(null);
          return;
        }
        
        setSession(fallbackSession);
        
        const newOrgId = fallbackSession?.user?.app_metadata?.org_id || 
                         fallbackSession?.user?.user_metadata?.org_id;
        
        if (newOrgId) {
          const org = await fetchOrganisation(newOrgId);
          setOrganisation(org);
        } else {
          setOrganisation(null);
        }
        return;
      }
      
      const newSession = refreshData.session;
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

  // Initialize on mount - try to get a fresh session
  useEffect(() => {
    // Try refreshSession first to get fresh JWT with org_id claim
    supabase.auth.refreshSession().then(({ data: refreshData, error }) => {
      if (error || !refreshData.session) {
        // Fall back to getSession for new sessions without refresh token
        return supabase.auth.getSession();
      }
      return { data: { session: refreshData.session }, error: null };
    }).then((result) => {
      const initialSession = result?.data?.session ?? null;
      setSession(initialSession);
      
      const initialOrgId = initialSession?.user?.app_metadata?.org_id || 
                           initialSession?.user?.user_metadata?.org_id;
      
      if (initialOrgId) {
        fetchOrganisation(initialOrgId).then(setOrganisation);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    // IMPORTANT: Do NOT use async callback or make Supabase calls directly inside
    // This prevents auth deadlock issues
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Only synchronous state updates here
        setSession(newSession);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        const newOrgId = newSession?.user?.app_metadata?.org_id || 
                         newSession?.user?.user_metadata?.org_id;
        
        if (newOrgId) {
          setTimeout(() => {
            fetchOrganisation(newOrgId).then(setOrganisation);
          }, 0);
        } else {
          setOrganisation(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchOrganisation]);

  const value: DataContextValue = {
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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export default DataContext;
