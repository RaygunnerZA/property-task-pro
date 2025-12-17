import React from "react";
import { Plus } from "lucide-react";
import { GroupableChip } from "./GroupableChip";
import { cn } from "@/lib/utils";

export interface PersonChip {
  id: string;
  user_id: string;
  display_name: string;
}

export interface TeamChip {
  id: string;
  name: string;
}

export interface ChipRowProps {
  people: PersonChip[];
  teams: TeamChip[];
  selectedPersonId?: string | null;
  selectedTeamIds: string[];
  onSelectPerson: (id: string | null) => void;
  onSelectTeam: (id: string) => void;
  onCreateNew: () => void;
  className?: string;
}

/**
 * ChipRow - Displays assigned people chips, team chips, and "+ NEW" chip
 */
export function ChipRow({
  people,
  teams,
  selectedPersonId,
  selectedTeamIds,
  onSelectPerson,
  onSelectTeam,
  onCreateNew,
  className,
}: ChipRowProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 items-center", className)}>
      {/* Selected Person Chips */}
      {people
        .filter((p) => p.user_id === selectedPersonId)
        .map((person) => (
          <GroupableChip
            key={person.id}
            label={person.display_name}
            variant="person"
            selected
            onSelect={() => onSelectPerson(null)}
            onRemove={() => onSelectPerson(null)}
          />
        ))}

      {/* Selected Team Chips */}
      {teams
        .filter((t) => selectedTeamIds.includes(t.id))
        .map((team) => (
          <GroupableChip
            key={team.id}
            label={team.name}
            variant="team"
            selected
            onSelect={() => onSelectTeam(team.id)}
            onRemove={() => onSelectTeam(team.id)}
          />
        ))}

      {/* + NEW Chip (ghost style) */}
      <GroupableChip
        label="+ NEW"
        variant="ghost"
        onSelect={onCreateNew}
      />
    </div>
  );
}
