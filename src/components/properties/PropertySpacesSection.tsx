import { useState } from "react";
import { useSpaces } from "@/hooks/useSpaces";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { cn } from "@/lib/utils";
import { SPACE_TEMPLATES } from "@/lib/taxonomy";

interface PropertySpacesSectionProps {
  propertyId: string;
}

export function PropertySpacesSection({ propertyId }: PropertySpacesSectionProps) {
  const { spaces, loading, refresh } = useSpaces(propertyId);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Group spaces by category (if space_type is "category") and regular spaces
  const categorySpaces = spaces.filter((s) => s.space_type === "category");
  const regularSpaces = spaces.filter((s) => s.space_type !== "category");

  // Group regular spaces by matching category names from SPACE_TEMPLATES
  const spacesByCategory = categorySpaces.reduce((acc, categorySpace) => {
    const categoryName = categorySpace.name;
    const children = regularSpaces.filter((space) => {
      // Check if space name exists in the category's template list
      return SPACE_TEMPLATES[categoryName as keyof typeof SPACE_TEMPLATES]?.includes(space.name);
    });
    acc[categoryName] = {
      category: categorySpace,
      children,
    };
    return acc;
  }, {} as Record<string, { category: typeof spaces[0]; children: typeof spaces[] }>);

  // Standalone spaces (not in any category)
  const standaloneSpaces = regularSpaces.filter((space) => {
    return !Object.values(spacesByCategory).some((group) =>
      group.children.some((s) => s.id === space.id)
    );
  });

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading spaces...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Spaces List */}
      {spaces.length > 0 ? (
        <div className="space-y-4">
          {/* Grouped by Category */}
          {Object.values(spacesByCategory).map((group) => (
            <div key={group.category.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm text-foreground">{group.category.name}</h4>
                <span className="text-xs text-muted-foreground">
                  ({group.children.length})
                </span>
              </div>
              {group.children.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-6">
                  {group.children.map((space) => (
                    <div
                      key={space.id}
                      className="px-3 py-1.5 rounded-[5px] bg-card shadow-e1 text-sm font-medium"
                    >
                      {space.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Standalone Spaces */}
          {standaloneSpaces.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground">Other Spaces</h4>
              <div className="flex flex-wrap gap-2">
                {standaloneSpaces.map((space) => (
                  <div
                    key={space.id}
                    className="px-3 py-1.5 rounded-[5px] bg-card shadow-e1 text-sm font-medium"
                  >
                    {space.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4">
          No spaces created yet. Add your first space to get started.
        </div>
      )}

      {/* Add Space Button */}
      <div className="pt-2 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddDialog(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Space
        </Button>
      </div>

      {/* Add Space Dialog */}
      <AddSpaceDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            refresh(); // Refresh spaces list when dialog closes
          }
        }}
        propertyId={propertyId} // Pass propertyId to pre-select
      />
    </div>
  );
}

