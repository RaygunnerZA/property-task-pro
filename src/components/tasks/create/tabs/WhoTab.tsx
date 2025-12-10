import { useState } from "react";
import { User, Users, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChipRow, PersonChip, TeamChip } from "@/components/chips";
import { GroupableChip } from "@/components/chips/GroupableChip";
import { NewAssigneeMenu } from "@/components/chips/NewAssigneeMenu";
import { useTeams } from "@/hooks/useTeams";
import { useOrgMembers } from "@/hooks/useOrgMembers";
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
  onTeamsChange,
}: WhoTabProps) {
  const { orgId } = useDataContext();
  const { teams, refresh: refreshTeams } = useTeams(orgId);
  const { members } = useOrgMembers();

  const [showNewMenu, setShowNewMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Local temp people (UI-only, not persisted)
  const [tempPeople, setTempPeople] = useState<PersonChip[]>([]);

  // Map org members to PersonChip format
  const allPeople: PersonChip[] = [
    ...members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      display_name: m.display_name,
    })),
    ...tempPeople,
  ];

  // Map teams to TeamChip format
  const allTeams: TeamChip[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  // Filter by search
  const filteredPeople = allPeople.filter((p) =>
    p.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTeams = allTeams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPerson = (userId: string | null) => {
    onUserChange(userId || undefined);
  };

  const toggleTeam = (teamId: string) => {
    if (assignedTeamIds.includes(teamId)) {
      onTeamsChange(assignedTeamIds.filter((id) => id !== teamId));
    } else {
      onTeamsChange([...assignedTeamIds, teamId]);
    }
  };

  const handlePersonCreated = (person: { id: string; display_name: string }) => {
    const newPerson: PersonChip = {
      id: person.id,
      user_id: person.id,
      display_name: person.display_name,
    };
    setTempPeople((prev) => [...prev, newPerson]);
    // Auto-select the new person
    onUserChange(person.id);
  };

  const handleTeamCreated = (teamId: string) => {
    refreshTeams();
    // Auto-select the new team
    onTeamsChange([...assignedTeamIds, teamId]);
  };

  return (
    <div className="space-y-4">
      {/* Assigned Chips Row */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Assigned
        </Label>
        <ChipRow
          people={allPeople}
          teams={allTeams}
          selectedPersonId={assignedUserId}
          selectedTeamIds={assignedTeamIds}
          onSelectPerson={handleSelectPerson}
          onSelectTeam={toggleTeam}
          onCreateNew={() => setShowNewMenu(true)}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search people or teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 shadow-engraved font-mono text-sm"
        />
      </div>

      {/* People List */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <User className="h-3.5 w-3.5" />
          People
        </Label>
        {filteredPeople.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filteredPeople.map((person) => (
              <GroupableChip
                key={person.id}
                label={person.display_name}
                variant="person"
                selected={assignedUserId === person.user_id}
                onSelect={() =>
                  handleSelectPerson(
                    assignedUserId === person.user_id ? null : person.user_id
                  )
                }
                onLongPress={() => {
                  // Future: show context menu
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            {searchQuery ? "No people match your search" : "No people available"}
          </p>
        )}
      </div>

      {/* Teams List */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Users className="h-3.5 w-3.5" />
          Teams
        </Label>
        {filteredTeams.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filteredTeams.map((team) => (
              <GroupableChip
                key={team.id}
                label={team.name}
                variant="team"
                selected={assignedTeamIds.includes(team.id)}
                onSelect={() => toggleTeam(team.id)}
                onLongPress={() => {
                  // Future: show context menu
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            {searchQuery ? "No teams match your search" : "No teams available"}
          </p>
        )}
      </div>

      {/* New Assignee Menu */}
      <NewAssigneeMenu
        open={showNewMenu}
        onOpenChange={setShowNewMenu}
        onPersonCreated={handlePersonCreated}
        onTeamCreated={handleTeamCreated}
      />
    </div>
  );
}
