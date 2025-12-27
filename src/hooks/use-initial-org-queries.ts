import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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
 * @param orgId - The organisation ID to query, or null if no org exists
 * @returns Object containing org, member, hasProperties, hasSpaces, isLoading, and error
 */
export function useInitialOrgQueries(orgId: string | null): UseInitialOrgQueriesResult {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [member, setMember] = useState<OrganisationMember | null>(null);
  const [hasProperties, setHasProperties] = useState(false);
  const [hasSpaces, setHasSpaces] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      // If no orgId, reset all state
      if (!orgId) {
        setOrg(null);
        setMember(null);
        setHasProperties(false);
        setHasSpaces(false);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          setError(userError.message);
          setIsLoading(false);
          return;
        }

        if (!user) {
          setError("No authenticated user");
          setIsLoading(false);
          return;
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
          setError(orgResult.error.message);
        } else {
          setOrg(orgResult.data);
        }

        // Handle member result
        if (memberResult.error && memberResult.error.code !== "PGRST116") {
          // PGRST116 is "not found" which is acceptable if user isn't a member yet
          console.error("[useInitialOrgQueries] Error fetching member:", memberResult.error);
          setError(memberResult.error.message);
        } else {
          setMember(memberResult.data || null);
        }

        // Handle properties result
        if (propertiesResult.error) {
          console.error("[useInitialOrgQueries] Error fetching properties:", propertiesResult.error);
        } else {
          setHasProperties((propertiesResult.count ?? 0) > 0);
        }

        // Handle spaces result
        if (spacesResult.error) {
          console.error("[useInitialOrgQueries] Error fetching spaces:", spacesResult.error);
        } else {
          setHasSpaces((spacesResult.count ?? 0) > 0);
        }

      } catch (err: any) {
        console.error("[useInitialOrgQueries] Unexpected error:", err);
        setError(err.message || "Failed to fetch org data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [orgId]);

  return {
    org,
    member,
    hasProperties,
    hasSpaces,
    isLoading,
    error,
  };
}

