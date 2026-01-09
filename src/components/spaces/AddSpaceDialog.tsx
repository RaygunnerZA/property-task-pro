import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { toast } from "sonner";
import {
  FolderOpen,
  Home,
  Building,
  Wrench,
  ShowerHead,
  Bath,
  CookingPot,
  Bed,
  Car,
  Package,
  Plug,
  Lightbulb,
  Flame,
  Settings,
  Sparkles,
  ClipboardList,
  Target,
} from "lucide-react";

interface AddSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties?: any[];
  propertyId?: string; // Optional: pre-select a property
}

export function AddSpaceDialog({ 
  open, 
  onOpenChange,
  properties = [],
  propertyId: initialPropertyId
}: AddSpaceDialogProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [propertyId, setPropertyId] = useState<string>(initialPropertyId || "");
  const [iconName, setIconName] = useState("home");
  const [iconColor, setIconColor] = useState("#8EC9CE");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Space name is required");
      return;
    }

    if (!propertyId) {
      toast.error("Please select a property");
      return;
    }

    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate space name within the same property
      const { data: existingSpaces, error: checkError } = await supabase
        .from("spaces")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .ilike("name", name.trim());

      if (checkError) {
        console.error("Error checking duplicates:", checkError);
      } else if (existingSpaces && existingSpaces.length > 0) {
        toast.error("A space with this name already exists in this property");
        setLoading(false);
        return;
      }

      // Create space
      const { data: newSpace, error: createError } = await supabase
        .from("spaces")
        .insert({
          org_id: orgId,
          property_id: propertyId,
          name: name.trim(),
        })
        .select()
        .single();

      if (createError) {
        console.error("Space creation error:", createError);
        throw createError;
      }

      toast.success("Space created!");
      // Reset form (but keep propertyId if it was pre-selected)
      setName("");
      if (!initialPropertyId) {
        setPropertyId("");
      }
      setIconName("home");
      setIconColor("#8EC9CE");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    } catch (err: any) {
      console.error("Create space failed:", err);
      toast.error(err.message || "Failed to create space");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName("");
      if (!initialPropertyId) {
        setPropertyId("");
      }
      setIconName("home");
      setIconColor("#8EC9CE");
      onOpenChange(false);
    }
  };

  // Update propertyId when initialPropertyId changes
  useEffect(() => {
    if (initialPropertyId) {
      setPropertyId(initialPropertyId);
    }
  }, [initialPropertyId]);

  // Get icon component for preview
  const getIconComponent = () => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      home: Home,
      building: Building,
      wrench: Wrench,
      shower: ShowerHead,
      bath: Bath,
      cooking: CookingPot,
      bed: Bed,
      car: Car,
      package: Package,
      plug: Plug,
      lightbulb: Lightbulb,
      flame: Flame,
      settings: Settings,
      sparkles: Sparkles,
      clipboard: ClipboardList,
      target: Target,
    };
    const IconComponent = iconMap[iconName] || FolderOpen;
    return <IconComponent className="w-10 h-10 text-white" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Space</DialogTitle>
          <DialogDescription>
            Enter the space details below. Spaces help organize tasks within properties.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Icon Preview */}
          <div className="flex justify-center">
            <div
              className="p-4 rounded-2xl transition-all duration-300"
              style={{
                backgroundColor: iconColor,
                boxShadow:
                  "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
              }}
            >
              {getIconComponent()}
            </div>
          </div>

          {/* Property Selection - Hide if propertyId is pre-selected */}
          {!initialPropertyId && (
            <div className="grid gap-2">
              <Label htmlFor="property">Property *</Label>
              <Select value={propertyId} onValueChange={setPropertyId} disabled={loading}>
                <SelectTrigger id="property">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.nickname || property.address || "Unnamed Property"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {properties.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No properties available. Please create a property first.
                </p>
              )}
            </div>
          )}

          {/* Space Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Space name *</Label>
            <Input
              id="name"
              placeholder="e.g. Kitchen, Bedroom, Office"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Icon Selection */}
          <div>
            <Label className="mb-2 block">Choose an icon (optional)</Label>
            <IconPicker value={iconName} onChange={setIconName} />
          </div>

          {/* Color Selection */}
          <div>
            <Label className="mb-2 block">Choose a color (optional)</Label>
            <ColorPicker value={iconColor} onChange={setIconColor} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !name.trim() || !propertyId || (!initialPropertyId && properties.length === 0)}
          >
            {loading ? "Creating..." : "Create Space"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

