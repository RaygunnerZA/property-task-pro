import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { getSpaceGroupById, getGroupIdFromDefaultUiGroup } from "@/components/onboarding/onboardingSpaceGroups";

export type SpaceWithType = {
  id: string;
  org_id: string;
  property_id: string;
  space_type_id: string | null;
  name: string | null;
  icon_name: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
  space_types?: {
    default_ui_group: string | null;
    default_icon: string | null;
  } | null;
};

export function useSpacesWithTypes(
  propertyId?: string,
  groupSlug?: string
) {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [spaces, setSpaces] = useState<SpaceWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgLoading) return;

    async function fetchSpaces() {
      if (!orgId) {
        setSpaces([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      let query = supabase
        .from("spaces")
        .select("*, space_types(default_ui_group, default_icon)")
        .eq("org_id", orgId);

      if (propertyId) query = query.eq("property_id", propertyId);

      const { data, error: err } = await query;

      if (err) {
        setError(err.message);
        setSpaces([]);
      } else {
        let result = (data ?? []) as SpaceWithType[];

        if (groupSlug) {
          const group = getSpaceGroupById(groupSlug);
          if (group) {
            result = result.filter((space) => {
              const defaultUiGroup = space.space_types?.default_ui_group;
              if (!defaultUiGroup) return false;
              const spaceGroupId = getGroupIdFromDefaultUiGroup(defaultUiGroup);
              return spaceGroupId === groupSlug;
            });
          }
        }

        setSpaces(result);
      }

      setLoading(false);
    }

    fetchSpaces();
  }, [propertyId, orgId, orgLoading, groupSlug]);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from("spaces")
      .select("*, space_types(default_ui_group, default_icon)")
      .eq("org_id", orgId);
    if (propertyId) query = query.eq("property_id", propertyId);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else {
      let result = (data ?? []) as SpaceWithType[];
      if (groupSlug) {
        const group = getSpaceGroupById(groupSlug);
        if (group) {
          result = result.filter((space) => {
            const defaultUiGroup = space.space_types?.default_ui_group;
            if (!defaultUiGroup) return false;
            const spaceGroupId = getGroupIdFromDefaultUiGroup(defaultUiGroup);
            return spaceGroupId === groupSlug;
          });
        }
      }
      setSpaces(result);
    }
    setLoading(false);
  }

  return { spaces, loading, error, refresh };
}
