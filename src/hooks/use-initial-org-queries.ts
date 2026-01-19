import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type Organisation = Tables<"organisations">;
type OrganisationMember = Tables<"organisation_members">;

interface UseInitialOrgQueriesResult {
  org: Organisation | null;
  member: OrganisationMember | null;
  hasProperties: boolean;
  hasSpaces: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Unified hook to fetch all initial org data in parallel.
 * This eliminates race conditions and ensures consistent loading state.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param orgId - The organisation ID to query, or null if no org exists
 * @returns Object containing org, member, hasProperties, hasSpaces, isLoading, and error
 */
export function useInitialOrgQueries(orgId: string | null): UseInitialOrgQueriesResult {
  const { 
    data, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: queryKeys.initialOrgData(orgId ?? undefined),
    queryFn: async (): Promise<{
      org: Organisation | null;
      member: OrganisationMember | null;
      hasProperties: boolean;
      hasSpaces: boolean;
    }> => {
      // If no orgId, return empty state
      if (!orgId) {
        return {
          org: null,
          member: null,
          hasProperties: false,
          hasSpaces: false,
        };
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("No authenticated user");
      }

      // Fetch all data in parallel using Promise.all
      const [orgResult, memberResult, propertiesResult, spacesResult] = await Promise.all([
        // Fetch organisation
        supabase
          .from("organisations")
          .select("*")
          .eq("id", orgId)
          .single(),
        
        // Fetch organisation member for current user
        supabase
          .from("organisation_members")
          .select("*")
          .eq("org_id", orgId)
          .eq("user_id", user.id)
          .maybeSingle(),
        
        // Check if properties exist (count query for efficiency)
        supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),
        
        // Check if spaces exist (count query for efficiency)
        supabase
          .from("spaces")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),
      ]);

      // Handle organisation result
      if (orgResult.error) {
        console.error("[useInitialOrgQueries] Error fetching org:", orgResult.error);
        throw orgResult.error;
      }

      // Handle member result
      let member: OrganisationMember | null = null;
      if (memberResult.error && memberResult.error.code !== "PGRST116") {
        // PGRST116 is "not found" which is acceptable if user isn't a member yet
        console.error("[useInitialOrgQueries] Error fetching member:", memberResult.error);
        throw memberResult.error;
      } else {
        member = memberResult.data || null;
      }

      // Handle properties result
      let hasProperties = false;
      if (propertiesResult.error) {
        console.error("[useInitialOrgQueries] Error fetching properties:", propertiesResult.error);
        // Don't throw - this is a non-critical query
      } else {
        hasProperties = (propertiesResult.count ?? 0) > 0;
      }

      // Handle spaces result
      let hasSpaces = false;
      if (spacesResult.error) {
        console.error("[useInitialOrgQueries] Error fetching spaces:", spacesResult.error);
        // Don't throw - this is a non-critical query
      } else {
        hasSpaces = (spacesResult.count ?? 0) > 0;
      }

      return {
        org: orgResult.data,
        member,
        hasProperties,
        hasSpaces,
      };
    },
    enabled: orgId !== null, // Only fetch when orgId is provided (even if null, we still want to handle it)
    staleTime: 2 * 60 * 1000, // 2 minutes - initial org data should be relatively fresh
    retry: 1,
  });

  return {
    org: data?.org ?? null,
    member: data?.member ?? null,
    hasProperties: data?.hasProperties ?? false,
    hasSpaces: data?.hasSpaces ?? false,
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
}
