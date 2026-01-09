import { useState, useRef } from "react";
import { Building2, MapPin, Plus, Search, X, ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StandardChip } from "@/components/chips/StandardChip";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhereTabProps {
  propertyId: string;
  spaceIds: string[];
  onPropertyChange: (propertyIds: string[]) => void;
  onSpacesChange: (spaceIds: string[]) => void;
  suggestedSpaces?: string[];
}

export function WhereTab({ 
  propertyId, 
  spaceIds, 
  onPropertyChange, 
  onSpacesChange,
  suggestedSpaces = []
}: WhereTabProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  // Track selected property IDs (for multiple selection)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(propertyId ? [propertyId] : []);
  // Use first property for spaces (spaces are property-specific)
  const primaryPropertyId = selectedPropertyIds.length > 0 ? selectedPropertyIds[0] : propertyId;
  const { spaces, loading: spacesLoading, refresh: refreshSpaces } = useSpaces(primaryPropertyId || undefined);
  
  const refreshProperties = () => {
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  };
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingGhostSpace, setPendingGhostSpace] = useState<string | null>(null);
  
  // Icon/color state for create modals
  const [propertyIcon, setPropertyIcon] = useState<string>("");
  const [propertyColor, setPropertyColor] = useState<string>("");
  const [spaceIcon, setSpaceIcon] = useState<string>("");
  const [spaceColor, setSpaceColor] = useState<string>("");
  const [propertyImageFile, setPropertyImageFile] = useState<File | null>(null);
  const [propertyImagePreview, setPropertyImagePreview] = useState<string | null>(null);
  const propertyFileInputRef = useRef<HTMLInputElement>(null);

  const handlePropertyImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPropertyImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPropertyImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearPropertyImage = () => {
    setPropertyImageFile(null);
    setPropertyImagePreview(null);
    if (propertyFileInputRef.current) propertyFileInputRef.current.value = "";
  };

  // Filter properties and spaces by search
  const filteredProperties = properties.filter(p => 
    (p.nickname || p.address).toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredSpaces = spaces.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Identify ghost chips (suggested but not in DB)
  const existingSpaceNames = spaces.map(s => s.name.toLowerCase());
  const ghostSpaces = suggestedSpaces.filter(
    suggested => !existingSpaceNames.includes(suggested.toLowerCase())
  );

  const handlePropertySelect = (id: string) => {
    let newSelectedIds: string[];
    if (selectedPropertyIds.includes(id)) {
      // Deselect property
      newSelectedIds = selectedPropertyIds.filter(pid => pid !== id);
    } else {
      // Select property (add to selection)
      newSelectedIds = [...selectedPropertyIds, id];
    }
    setSelectedPropertyIds(newSelectedIds);
    onPropertyChange(newSelectedIds);
    // Clear spaces when properties change
    if (newSelectedIds.length === 0) {
      onSpacesChange([]);
    }
  };

  const toggleSpace = (spaceId: string) => {
    if (spaceIds.includes(spaceId)) {
      onSpacesChange(spaceIds.filter(id => id !== spaceId));
    } else {
      onSpacesChange([...spaceIds, spaceId]);
    }
  };

  const handleGhostSpaceClick = (spaceName: string) => {
    // Allow direct selection of ghost chips - store with ghost prefix
    // This enables "just-in-time" creation during task save
    const ghostId = `ghost-space-${spaceName}`;
    if (spaceIds.includes(ghostId)) {
      onSpacesChange(spaceIds.filter(id => id !== ghostId));
    } else {
      onSpacesChange([...spaceIds, ghostId]);
    }
    // Keep modal option for manual creation (optional)
    // setPendingGhostSpace(spaceName);
    // setNewSpaceName(spaceName);
    // setShowCreateSpace(true);
  };

  const handleCreateProperty = async () => {
    if (!newPropertyName.trim() || !orgId) return;
    
    setCreating(true);
    try {
      await supabase.auth.refreshSession();
      
      const { data, error } = await supabase
        .from("properties")
        .insert({
          org_id: orgId,
          address: newPropertyName.trim(),
          nickname: newPropertyName.trim(),
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Property created" });
      setNewPropertyName("");
      setShowCreateProperty(false);
      refreshProperties();
      // Add new property to selection
      const newSelectedIds = [...selectedPropertyIds, data.id];
      setSelectedPropertyIds(newSelectedIds);
      onPropertyChange(newSelectedIds);
    } catch (err: any) {
      toast({ 
        title: "Error creating property", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim() || !primaryPropertyId || !orgId) return;
    
    setCreating(true);
    try {
      await supabase.auth.refreshSession();
      
        const { data, error } = await supabase
          .from("spaces")
          .insert({
            org_id: orgId,
            property_id: primaryPropertyId,
            name: newSpaceName.trim(),
          })
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Space created" });
      setNewSpaceName("");
      setPendingGhostSpace(null);
      setShowCreateSpace(false);
      // Add the new space to selection immediately
      onSpacesChange([...spaceIds, data.id]);
      // Refresh the spaces list to include the new space
      await refreshSpaces();
    } catch (err: any) {
      toast({ 
        title: "Error creating space", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const resetPropertyModal = () => {
    setNewPropertyName("");
    setPropertyIcon("");
    setPropertyColor("");
    clearPropertyImage();
  };

  const resetSpaceModal = () => {
    setNewSpaceName("");
    setSpaceIcon("");
    setSpaceColor("");
    setPendingGhostSpace(null);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search properties and spaces..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 shadow-engraved font-mono text-sm"
        />
      </div>

      {/* Property Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Building2 className="h-3.5 w-3.5" />
            Property
          </Label>
          <button
            type="button"
            onClick={() => {
              resetPropertyModal();
              setShowCreateProperty(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
        
        {propertiesLoading ? (
          <p className="text-xs text-muted-foreground">Loading properties...</p>
        ) : filteredProperties.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filteredProperties.map(property => (
              <StandardChip
                key={property.id}
                label={property.nickname || property.address}
                selected={selectedPropertyIds.includes(property.id)}
                onSelect={() => handlePropertySelect(property.id)}
                color={property.icon_color_hex || undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {searchQuery ? "No properties match" : "No properties yet"}
          </p>
        )}
      </div>

      {/* Space Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <MapPin className="h-3.5 w-3.5" />
            Spaces
          </Label>
          <button
            type="button"
            onClick={() => {
              resetSpaceModal();
              setShowCreateSpace(true);
            }}
            disabled={!propertyId}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        {selectedPropertyIds.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Select a property first
          </p>
        ) : spacesLoading ? (
          <p className="text-xs text-muted-foreground">Loading spaces...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Existing spaces */}
            {filteredSpaces.map(space => (
              <StandardChip
                key={space.id}
                label={space.name}
                selected={spaceIds.includes(space.id)}
                onSelect={() => toggleSpace(space.id)}
                icon={space.icon ? <span>{space.icon}</span> : undefined}
              />
            ))}
            
            {/* Ghost chips for AI suggestions not in DB */}
            {ghostSpaces.map((ghostName, idx) => {
              const ghostId = `ghost-space-${ghostName}`;
              const isSelected = spaceIds.includes(ghostId);
              return (
                <StandardChip
                  key={`ghost-${idx}`}
                  label={isSelected ? ghostName : `+ ${ghostName}`}
                  ghost={!isSelected}
                  selected={isSelected}
                  onSelect={() => handleGhostSpaceClick(ghostName)}
                />
              );
            })}
            
            {filteredSpaces.length === 0 && ghostSpaces.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No spaces for this property
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create Property Modal */}
      <Dialog open={showCreateProperty} onOpenChange={setShowCreateProperty}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Property</DialogTitle>
            <DialogDescription>
              Create a new property to organize your tasks and spaces.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              placeholder="Property name or address"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              className="shadow-engraved"
            />

            {/* Image row */}
            <div className="flex gap-2">
              <input
                ref={propertyFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePropertyImageSelect}
                className="hidden"
              />
              
              {propertyImagePreview ? (
                <div className="relative w-16 h-16 rounded-[5px] overflow-hidden shadow-e1">
                  <img src={propertyImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearPropertyImage}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-background/80 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => propertyFileInputRef.current?.click()}
                  className="w-16 h-16 rounded-[5px] border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px]">Image</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Icon</Label>
              <IconPicker value={propertyIcon} onChange={setPropertyIcon} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Color</Label>
              <ColorPicker value={propertyColor} onChange={setPropertyColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateProperty(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProperty}
              disabled={!newPropertyName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Space Modal */}
      <Dialog open={showCreateSpace} onOpenChange={(open) => {
        setShowCreateSpace(open);
        if (!open) resetSpaceModal();
      }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingGhostSpace ? `Create "${pendingGhostSpace}"?` : "Create Space"}
            </DialogTitle>
            <DialogDescription>
              {pendingGhostSpace
                ? `Create a new space called "${pendingGhostSpace}" within this property.`
                : "Create a new space within this property to organize tasks by location."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              placeholder="Space name"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              className="shadow-engraved"
            />
            {pendingGhostSpace && (
              <p className="text-xs text-muted-foreground">
                This space doesn't exist yet. Create it now?
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Icon</Label>
              <IconPicker value={spaceIcon} onChange={setSpaceIcon} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Color</Label>
              <ColorPicker value={spaceColor} onChange={setSpaceColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateSpace(false);
                resetSpaceModal();
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSpace}
              disabled={!newSpaceName.trim() || !propertyId || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
