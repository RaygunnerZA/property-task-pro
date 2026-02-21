/**
 * Space Group Identity Card
 * First column for Space Group screens: placeholder image + intro text.
 * Mirrors Property Identity Card layout (image + info).
 */
import type { SpaceGroup } from "@/components/onboarding/onboardingSpaceGroups";
import { ImageIcon, Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpaceGroupIdentityCardProps {
  group: SpaceGroup;
  propertyName?: string | null;
  onAddTask?: () => void;
  onSeeTasks?: () => void;
}

export function SpaceGroupIdentityCard({
  group,
  propertyName,
  onAddTask,
  onSeeTasks,
}: SpaceGroupIdentityCardProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="bg-card/60 rounded-[8px] overflow-hidden shadow-e1 my-4 mx-2">
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
          {(onAddTask || onSeeTasks) && (
            <div className="flex flex-col gap-2 mt-2">
              {onAddTask && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddTask}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              )}
              {onSeeTasks && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSeeTasks}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <ListChecks className="h-4 w-4 mr-2" />
                  See {group.label} Tasks
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
