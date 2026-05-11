import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
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

  /**
   * Active organisation for org-scoped data — same source as `useActiveOrg`:
   * derived from `organisation_members` (first non-personal org, else first membership).
   * Do not use JWT `app_metadata.org_id` for queries; it can lag or diverge from membership.
   */
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

export function useAuth() {
  const { session, user, isAuthenticated, loading } = useDataContext();
  return { session, user, isAuthenticated, loading };
}

export function useOrg() {
  const { orgId, organisation, loading } = useDataContext();
  const { isLoading: orgLoading } = useActiveOrg();
  return { orgId, organisation, loading: loading || orgLoading };
}

export function useCurrentUser() {
  const { user, userId, loading } = useDataContext();
  return { user, userId, loading };
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const queryClient = useQueryClient();
  const { orgId: activeOrgId } = useActiveOrg();

  const [session, setSession] = useState<Session | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const isAuthenticated = !!session;

  const jwtOrgId =
    session?.user?.app_metadata?.org_id ?? session?.user?.user_metadata?.org_id ?? null;

  const orgId = activeOrgId;
  const contractorToken = session?.user?.app_metadata?.contractor_token ?? null;
  const isOrgUser = !!orgId && !!userId;
  const isContractor = !!contractorToken && !orgId;

  const fetchOrganisation = useCallback(async (id: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("organisations")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116" || fetchError.message?.includes("0 rows")) {
          console.debug(
            "Cannot fetch organisation - user not yet a member (expected during invitation acceptance):",
            fetchError
          );
        } else {
          console.error("Failed to fetch organisation:", fetchError);
        }
        return null;
      }
      return data as Organisation;
    } catch (err) {
      console.error("Error fetching organisation:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!activeOrgId) {
      setOrganisation(null);
      return;
    }
    let cancelled = false;
    void fetchOrganisation(activeOrgId).then((org) => {
      if (!cancelled) setOrganisation(org);
    });
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, fetchOrganisation]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (jwtOrgId && activeOrgId && jwtOrgId !== activeOrgId) {
      console.warn("[DataContext] JWT org_id differs from membership active org", {
        jwtOrgId,
        activeOrgId,
      });
    }
  }, [jwtOrgId, activeOrgId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        const {
          data: { session: fallbackSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
          setOrganisation(null);
          return;
        }

        setSession(fallbackSession);
      } else {
        setSession(refreshData.session);
      }

      void queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      void queryClient.invalidateQueries({ queryKey: ["activeOrg"] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to refresh session");
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then((result) => {
        const initialSession = result?.data?.session ?? null;
        setSession(initialSession);
        setLoading(false);
      })
      .catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: DataContextValue = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export default DataContext;
