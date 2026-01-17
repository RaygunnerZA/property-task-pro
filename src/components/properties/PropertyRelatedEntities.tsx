import { useMemo } from "react";
import { useGroups } from "@/hooks/useGroups";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { ENABLE_GROUPS_FEATURE } from "@/lib/featureFlags";
import { Card } from "@/components/ui/card";
import { Users, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyRelatedEntitiesProps {
  propertyId: string;
  tasks?: any[];
}

/**
 * Property Related Entities
 * Shows Groups and Teams affecting this property
 * Optional section - only renders if data exists
 */
export function PropertyRelatedEntities({
  propertyId,
  tasks = [],
}: PropertyRelatedEntitiesProps) {
  const { orgId } = useActiveOrg();
  const { groups } = useGroups();

  // Extract unique group IDs and team IDs from property's tasks
  const { groupIds, teamIds } = useMemo(() => {
    const groupSet = new Set<string>();
    const teamSet = new Set<string>();

    tasks.forEach((task) => {
      // Parse groups from task
      if (task.groups) {
        try {
          const taskGroups = typeof task.groups === 'string' ? JSON.parse(task.groups) : task.groups;
          if (Array.isArray(taskGroups)) {
            taskGroups.forEach((group: any) => {
              if (group?.id) groupSet.add(group.id);
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }

      // Parse teams from task
      if (task.teams) {
        try {
          const taskTeams = typeof task.teams === 'string' ? JSON.parse(task.teams) : task.teams;
          if (Array.isArray(taskTeams)) {
            taskTeams.forEach((team: any) => {
              if (team?.id) teamSet.add(team.id);
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    });

    return {
      groupIds: Array.from(groupSet),
      teamIds: Array.from(teamSet),
    };
  }, [tasks]);

  // Fetch teams data
  const { data: teamsData = [] } = useQuery({
    queryKey: ["property-teams", orgId, teamIds],
    queryFn: async () => {
      if (!orgId || teamIds.length === 0) return [];
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("org_id", orgId)
        .in("id", teamIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && teamIds.length > 0,
  });

  // Filter groups to only those related to this property
  const relatedGroups = useMemo(() => {
    if (!ENABLE_GROUPS_FEATURE) return [];
    if (groupIds.length === 0) return [];
    return groups.filter((group) => groupIds.includes(group.id));
  }, [groups, groupIds]);

  // Don't render if no related entities
  if (relatedGroups.length === 0 && teamsData.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border p-4 space-y-4">
      {relatedGroups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Groups</h3>
          <div className="space-y-2">
            {relatedGroups.map((group) => (
              <Card
                key={group.id}
                className="p-3 shadow-e1 bg-card hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{group.name}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {teamsData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Teams</h3>
          <div className="space-y-2">
            {teamsData.map((team: any) => (
              <Card
                key={team.id}
                className="p-3 shadow-e1 bg-card hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{team.name}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

