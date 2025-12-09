import { useState } from "react";
import { User, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTeams } from "@/hooks/useTeams";
import { useDataContext } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";

interface WhoTabProps {
  assignedUserId?: string;
  assignedTeamIds: string[];
  onUserChange: (userId: string | undefined) => void;
  onTeamsChange: (teamIds: string[]) => void;
}

export function WhoTab({ 
  assignedUserId, 
  assignedTeamIds, 
  onUserChange, 
  onTeamsChange 
}: WhoTabProps) {
  const { orgId } = useDataContext();
  const { teams } = useTeams(orgId);

  const toggleTeam = (teamId: string) => {
    if (assignedTeamIds.includes(teamId)) {
      onTeamsChange(assignedTeamIds.filter(id => id !== teamId));
    } else {
      onTeamsChange([...assignedTeamIds, teamId]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Assign to User */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <User className="h-4 w-4 text-muted-foreground" />
          Assign to Person
        </Label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={!assignedUserId ? "default" : "outline"}
            className="cursor-pointer font-mono text-xs uppercase"
            onClick={() => onUserChange(undefined)}
          >
            Unassigned
          </Badge>
          {/* In production, this would come from org members */}
        </div>
        <p className="text-xs text-muted-foreground">
          User assignment will be available when members are loaded
        </p>
      </div>

      {/* Assign to Teams */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          Assign to Teams
        </Label>
        {teams.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {teams.map(team => (
              <Badge
                key={team.id}
                variant={assignedTeamIds.includes(team.id) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer font-mono text-xs uppercase transition-all",
                  assignedTeamIds.includes(team.id) && "bg-primary text-primary-foreground"
                )}
                onClick={() => toggleTeam(team.id)}
              >
                {team.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No teams available</p>
        )}
      </div>
    </div>
  );
}
