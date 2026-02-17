/**
 * Space Group Identity Card
 * First column for Space Group screens: placeholder image + intro text.
 * Mirrors Property Identity Card layout (image + info).
 */
import type { SpaceGroup } from "@/components/onboarding/onboardingSpaceGroups";
import { ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpaceGroupIdentityCardProps {
  group: SpaceGroup;
  propertyName?: string | null;
  onAddTask?: () => void;
}

export function SpaceGroupIdentityCard({
  group,
  propertyName,
  onAddTask,
}: SpaceGroupIdentityCardProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="bg-card rounded-[8px] overflow-hidden shadow-e1 my-4 mx-2">
        {/* Placeholder Image */}
        <div
          className="w-full aspect-[4/3] flex items-center justify-center bg-muted/50"
          style={{ backgroundColor: `${group.color}20` }}
        >
          <ImageIcon className="h-12 w-12 text-muted-foreground/60" />
        </div>

        {/* Intro Text */}
        <div className="px-[9px] py-4 space-y-3">
          <h2 className="font-semibold text-lg text-foreground leading-tight">
            {group.label}
          </h2>
          {propertyName && (
            <p className="text-xs text-muted-foreground">{propertyName}</p>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {group.description}
          </p>
          {onAddTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddTask}
              className="w-full mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
