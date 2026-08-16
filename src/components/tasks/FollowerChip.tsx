import { Eye } from "lucide-react";
import { SemanticChip } from "@/components/chips/semantic";
import { personInitials } from "@/lib/taskFollowers";
import { cn } from "@/lib/utils";

export type FollowerChipPerson = {
  userId: string;
  displayName: string;
};

export function followerChipLabel(people: FollowerChipPerson[]): string {
  return people.map((p) => personInitials(p.displayName)).join(" | ");
}

type FollowerChipProps = {
  people: FollowerChipPerson[];
  onPress?: () => void;
  onRemoveOne?: (userId: string) => void;
  className?: string;
};

/** Compact watcher chip: eye + initials, one chip for many people. */
export function FollowerChip({
  people,
  onPress,
  onRemoveOne,
  className,
}: FollowerChipProps) {
  if (people.length === 0) return null;
  const label = followerChipLabel(people);
  const canRemove = Boolean(onRemoveOne);
  const ariaLabel = `Followers ${people.map((p) => personInitials(p.displayName)).join(", ")}`;

  return (
    <SemanticChip
      epistemic="fact"
      label={label}
      icon={<Eye className="h-3 w-3 text-muted-foreground" aria-hidden />}
      truncate={false}
      onPress={canRemove ? undefined : onPress}
      dropdown={canRemove}
      dropdownContent={
        canRemove ? (
          <div className="p-1.5 min-w-[140px]">
            <p className="px-1 pb-1 text-2xs font-mono uppercase tracking-wide text-muted-foreground">
              Followers
            </p>
            <div className="space-y-0.5">
              {people.map((person) => (
                <div
                  key={person.userId}
                  className="flex items-center justify-between gap-2 px-1 py-0.5"
                >
                  <span className="font-mono text-2xs uppercase tracking-wide truncate">
                    {personInitials(person.displayName)}
                    <span className="ml-1.5 text-muted-foreground normal-case tracking-normal">
                      {person.displayName}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Stop ${person.displayName} following`}
                    onClick={() => onRemoveOne?.(person.userId)}
                    className="shrink-0 px-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : undefined
      }
      className={cn("shrink-0 max-w-none", className)}
      ariaLabel={ariaLabel}
    />
  );
}
