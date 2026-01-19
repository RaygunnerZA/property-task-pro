/**
 * WherePanel - Task Context Resolver for location
 * 
 * Design Constraints:
 * - Uses ContextResolver wrapper
 * - Step-based flow: Property → Space → SubSpace
 * - Property defaulting logic
 * - Composite property+space chips when space selected
 * - Chips below perforation = commitment (no dashed outlines)
 */

import { useState, useRef, useEffect } from "react";
import { Building2, MapPin, Plus, X, ImagePlus, Home, Hotel, Warehouse, Store, Castle } from "lucide-react";
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
import { Chip } from "@/components/chips/Chip";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContextResolver } from "../ContextResolver";
import { InstructionBlock } from "../InstructionBlock";
import { cn } from "@/lib/utils";

// Property icon mapping
const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

interface WherePanelProps {
  propertyId: string;
  spaceIds: string[];
  onPropertyChange: (propertyIds: string[]) => void;
  onSpacesChange: (spaceIds: string[]) => void;
  suggestedSpaces?: string[];
  defaultPropertyId?: string;
  instructionBlock?: { section: string; entityName: string; entityType: string } | null;
  onInstructionDismiss?: () => void;
}

export function WherePanel({ 
  propertyId, 
  spaceIds, 
  onPropertyChange, 
  onSpacesChange, 
  suggestedSpaces = [],
  defaultPropertyId,
  instructionBlock,
  onInstructionDismiss
}: WherePanelProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  
  // Property defaulting logic (deterministic)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(() => {
    // If task is created from a property context → preselect that property
    if (defaultPropertyId) return [defaultPropertyId];
    // If the user has exactly one property → auto-select it
    if (properties.length === 1) return [properties[0].id];
    // Otherwise → do not auto-select
    return propertyId ? [propertyId] : [];
  });
  
  // Use first property for spaces (spaces are property-specific)
  const primaryPropertyId = selectedPropertyIds.length > 0 ? selectedPropertyIds[0] : propertyId;
  const { spaces, loading: spacesLoading, refresh: refreshSpaces } = useSpaces(primaryPropertyId || undefined);
  
  // Check if instruction block should be shown (only for 'where' section and 'space' type)
  const showInstruction = instructionBlock?.section === 'where' && instructionBlock?.entityType === 'space';
  const spaceName = instructionBlock?.entityName;
  
  // Check if entity is now resolved (space exists)
  const isResolved = spaceName ? (
    spaces.some(s => s.name.toLowerCase() === spaceName.toLowerCase()) ||
    spaceIds.some(id => id.includes(`ghost-space-${spaceName.toLowerCase()}`))
  ) : false;
  
  // Auto-dismiss instruction block when resolved
  useEffect(() => {
    if (showInstruction && isResolved && onInstructionDismiss) {
      onInstructionDismiss();
    }
  }, [showInstruction, isResolved, onInstructionDismiss, spaces, spaceIds, spaceName]);
  
  // Update selectedPropertyIds when properties load and user has exactly one
  useEffect(() => {
    if (properties.length === 1 && selectedPropertyIds.length === 0 && !defaultPropertyId && !propertyId) {
      setSelectedPropertyIds([properties[0].id]);
      onPropertyChange([properties[0].id]);
    }
  }, [properties.length, defaultPropertyId, propertyId, selectedPropertyIds.length, onPropertyChange]);
  
  const refreshProperties = () => {
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  };
  
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

  // Update selectedPropertyIds when properties load and user has exactly one
  useEffect(() => {
    if (properties.length === 1 && selectedPropertyIds.length === 0 && !defaultPropertyId && !propertyId) {
      setSelectedPropertyIds([properties[0].id]);
      onPropertyChange([properties[0].id]);
    }
  }, [properties.length, defaultPropertyId, propertyId]);

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

  // No filtering needed - show all properties and spaces
  const filteredProperties = properties;
  const filteredSpaces = spaces;

  // Identify ghost chips (suggested but not in DB)
  const existingSpaceNames = spaces.map(s => s.name.toLowerCase());
  const ghostSpaces = suggestedSpaces.filter(
    suggested => !existingSpaceNames.includes(suggested.toLowerCase())
  );

  // Get selected space for composite display
  const selectedSpace = spaces.find(s => spaceIds.includes(s.id));
  const selectedProperty = properties.find(p => selectedPropertyIds.includes(p.id));

  const handlePropertySelect = (id: string) => {
    let newSelectedIds: string[];
    if (selectedPropertyIds.includes(id)) {
      newSelectedIds = selectedPropertyIds.filter(pid => pid !== id);
    } else {
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
    const ghostId = `ghost-space-${spaceName}`;
    if (spaceIds.includes(ghostId)) {
      onSpacesChange(spaceIds.filter(id => id !== ghostId));
    } else {
      onSpacesChange([...spaceIds, ghostId]);
    }
  };

  const handleCreateProperty = async () => {
    if (!newPropertyName.trim() || !orgId) return;
    
    setCreating(true);
    try {
      const { refreshSession } = await import("@/lib/sessionManager");
      await refreshSession();
      
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
      const newSelectedIds = [...selectedPropertyIds, data.id];
      setSelectedPropertyIds(newSelectedIds);
      onPropertyChange(newSelectedIds);
    } catch (err: any) {
      toast({ 
        title: "Couldn't create property", 
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
      const { refreshSession } = await import("@/lib/sessionManager");
      await refreshSession();
      
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
      onSpacesChange([...spaceIds, data.id]);
      await refreshSpaces();
    } catch (err: any) {
      toast({ 
        title: "Couldn't create space", 
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
    <div className="space-y-6">
      {/* Instruction Block - Show when space is not in system */}
      {showInstruction && !isResolved && spaceName && (
        <InstructionBlock
          message={`${spaceName} isn't in the system yet. Choose how you'd like to add it.`}
          buttons={[
            {
              label: "Create space",
              helperText: "Add this space to the selected property",
              onClick: () => {
                setNewSpaceName(spaceName);
                setPendingGhostSpace(spaceName);
                setShowCreateSpace(true);
                // Instruction block will dismiss when space is created
              },
            },
          ]}
          onDismiss={onInstructionDismiss}
        />
      )}
      
      {/* Step 1: Property (always shown first) */}
      <ContextResolver
        title=""
        helperText=""
      >
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* PROPERTY + chip - Fixed on left (Add Property Button) */}
          <button
            type="button"
            onClick={() => {
              resetPropertyModal();
              setShowCreateProperty(true);
            }}
            className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] shrink-0 font-mono transition-all duration-150 cursor-pointer"
          >
            <span className="text-[12px] uppercase leading-[16px]">PROPERTY</span>
            <Plus className="h-3.5 w-3.5" />
          </button>
          
          {/* Scrollable middle section with property chips */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
            <div className="flex items-center gap-2 h-[40px]">
              {/* Step 3: Composite property+space chip when space is selected */}
              {selectedSpace && selectedProperty ? (
                <Chip
                  key={`composite-${selectedProperty.id}-${selectedSpace.id}`}
                  role="filter"
                  label={`${selectedProperty.nickname || selectedProperty.address} – ${selectedSpace.name}`.toUpperCase()}
                  selected={true}
                  onSelect={() => {}}
                  color={selectedProperty.icon_color_hex || undefined}
                  icon={(() => {
                    const iconName = selectedProperty.icon_name || "home";
                    const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
                    return <IconComponent className="h-3.5 w-3.5" />;
                  })()}
                  className="shrink-0"
                />
              ) : null}
              
              {/* Other properties (inactive when space selected, visible but muted) */}
              {propertiesLoading ? (
                <p className="text-xs text-muted-foreground whitespace-nowrap">Loading properties...</p>
              ) : filteredProperties.length > 0 ? (
                filteredProperties.map(property => {
                  const isInactive = selectedSpace && !selectedPropertyIds.includes(property.id);
                  const isSelected = selectedPropertyIds.includes(property.id) && !selectedSpace;
                  
                  // Don't show selected property if it's merged into composite chip
                  if (selectedSpace && selectedPropertyIds.includes(property.id)) {
                    return null;
                  }
                  
                  return (
                    <Chip
                      key={property.id}
                      role="filter"
                      label={(property.nickname || property.address).toUpperCase()}
                      selected={isSelected}
                      onSelect={() => handlePropertySelect(property.id)}
                      color={property.icon_color_hex || undefined}
                      icon={(() => {
                        const iconName = property.icon_name || "home";
                        const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
                        return <IconComponent className="h-3.5 w-3.5" />;
                      })()}
                      className={cn(
                        "shrink-0",
                        isInactive && "opacity-50"
                      )}
                    />
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  No properties yet
                </p>
              )}
            </div>
          </div>
        </div>
      </ContextResolver>

      {/* Step 2: Spaces (only appears when property is selected) */}
      {selectedPropertyIds.length > 0 && !selectedSpace && (
        <ContextResolver
          title=""
          helperText=""
        >
          <div className="flex items-center gap-2 w-full min-w-0">
            {/* SPACES + chip - Fixed on left (Add Space Button) */}
            <button
              type="button"
              onClick={() => {
                resetSpaceModal();
                setShowCreateSpace(true);
              }}
              className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] shrink-0 font-mono transition-all duration-150 cursor-pointer"
            >
              <span className="text-[12px] uppercase leading-[16px]">SPACES</span>
              <Plus className="h-3.5 w-3.5" />
            </button>
            
            {/* Scrollable middle section with space chips */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
              <div className="flex items-center gap-2 h-[40px]">
                {spacesLoading ? (
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Loading spaces...</p>
                ) : filteredSpaces.length > 0 || ghostSpaces.length > 0 ? (
                  <>
                    {filteredSpaces.map(space => (
                      <Chip
                        key={space.id}
                        role="filter"
                        label={space.name.toUpperCase()}
                        selected={spaceIds.includes(space.id)}
                        onSelect={() => toggleSpace(space.id)}
                        icon={space.icon ? <span>{space.icon}</span> : undefined}
                        className="shrink-0"
                      />
                    ))}
                    
                    {ghostSpaces.map((ghostName, idx) => {
                      const ghostId = `ghost-space-${ghostName}`;
                      const isSelected = spaceIds.includes(ghostId);
                      return (
                      <Chip
                        key={`ghost-${idx}`}
                        role="suggestion"
                        label={isSelected ? ghostName.toUpperCase() : `+ ${ghostName.toUpperCase()}`}
                        selected={isSelected}
                        onSelect={() => handleGhostSpaceClick(ghostName)}
                        animate={true}
                        className="shrink-0"
                      />
                      );
                    })}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    No spaces for this property
                  </p>
                )}
              </div>
            </div>
          </div>
        </ContextResolver>
      )}

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
              <label className="text-xs text-muted-foreground">Choose Icon</label>
              <IconPicker value={propertyIcon} onChange={setPropertyIcon} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Choose Color</label>
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
              <label className="text-xs text-muted-foreground">Choose Icon</label>
              <IconPicker value={spaceIcon} onChange={setSpaceIcon} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Choose Color</label>
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
              disabled={!newSpaceName.trim() || !primaryPropertyId || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

