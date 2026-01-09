import { useState } from "react";
import { usePropertyThemes } from "@/hooks/use-property-themes";
import { useThemes } from "@/hooks/useThemes";
import { StandardChip } from "@/components/chips/StandardChip";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X } from "lucide-react";
import { getIconByName } from "@/components/ui/IconPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PropertyThemesSectionProps {
  propertyId: string;
}

export function PropertyThemesSection({ propertyId }: PropertyThemesSectionProps) {
  const { themes: propertyThemes, loading, addTheme, removeTheme } = usePropertyThemes(propertyId);
  const { themes: allThemes } = useThemes(); // Get all org themes
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");

  // Get themes not yet linked to this property
  const availableThemes = allThemes.filter(
    (theme) => !propertyThemes.some((pt) => pt.id === theme.id)
  );

  const handleAddTheme = async () => {
    if (!selectedThemeId) {
      toast.error("Please select a theme");
      return;
    }

    const result = await addTheme(selectedThemeId);
    if (result.error) {
      toast.error("Failed to add theme");
    } else {
      toast.success("Theme added");
      setSelectedThemeId("");
      setShowAddDropdown(false);
    }
  };

  const handleRemoveTheme = async (themeId: string) => {
    const result = await removeTheme(themeId);
    if (result.error) {
      toast.error("Failed to remove theme");
    } else {
      toast.success("Theme removed");
    }
  };

  // Group themes by parent (groups) and children (categories)
  const groupedThemes = propertyThemes.reduce((acc, theme) => {
    if (theme.type === "group" && !theme.parent_id) {
      // Parent theme (group)
      acc[theme.id] = {
        parent: theme,
        children: propertyThemes.filter(
          (t) => t.parent_id === theme.id
        ),
      };
    }
    return acc;
  }, {} as Record<string, { parent: typeof propertyThemes[0]; children: typeof propertyThemes }>);

  // Standalone themes (no parent)
  const standaloneThemes = propertyThemes.filter(
    (theme) => !theme.parent_id && theme.type !== "group"
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading themes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Active Themes */}
      {propertyThemes.length > 0 ? (
        <div className="space-y-4">
          {/* Grouped Themes (Parent + Children) */}
          {Object.values(groupedThemes).map((group) => (
            <div key={group.parent.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <StandardChip
                  label={group.parent.name}
                  selected={true}
                  onRemove={() => handleRemoveTheme(group.parent.id)}
                  icon={group.parent.icon ? getIconByName(group.parent.icon) : <Tag className="h-3 w-3" />}
                  color={group.parent.color || undefined}
                />
              </div>
              {group.children.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-4">
                  {group.children.map((child) => (
                    <StandardChip
                      key={child.id}
                      label={child.name}
                      selected={true}
                      onRemove={() => handleRemoveTheme(child.id)}
                      icon={child.icon ? getIconByName(child.icon) : <Tag className="h-3 w-3" />}
                      color={child.color || undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Standalone Themes */}
          {standaloneThemes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {standaloneThemes.map((theme) => (
                <StandardChip
                  key={theme.id}
                  label={theme.name}
                  selected={true}
                  onRemove={() => handleRemoveTheme(theme.id)}
                  icon={theme.icon ? getIconByName(theme.icon) : <Tag className="h-3 w-3" />}
                  color={theme.color || undefined}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4">
          No themes linked to this property yet.
        </div>
      )}

      {/* Add Theme */}
      <div className="pt-2 border-t border-border/50">
        {showAddDropdown ? (
          <div className="space-y-3">
            <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
              <SelectTrigger className="input-neomorphic">
                <SelectValue placeholder="Select a theme to add" />
              </SelectTrigger>
              <SelectContent>
                {availableThemes.length > 0 ? (
                  availableThemes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No themes available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddTheme}
                disabled={!selectedThemeId}
                className="btn-neomorphic"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddDropdown(false);
                  setSelectedThemeId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddDropdown(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Theme
          </Button>
        )}
      </div>
    </div>
  );
}

