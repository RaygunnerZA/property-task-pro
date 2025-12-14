import { useState } from "react";
import { Building2, MapPin, Plus, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProperties } from "@/hooks/useProperties";
import { useSpaces } from "@/hooks/useSpaces";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WhereTabProps {
  propertyId: string;
  spaceIds: string[];
  onPropertyChange: (propertyId: string) => void;
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
  const { orgId } = useDataContext();
  const { toast } = useToast();
  const { properties, loading: propertiesLoading, refresh: refreshProperties } = useProperties();
  const { spaces, loading: spacesLoading, refresh: refreshSpaces } = useSpaces(propertyId || undefined);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingGhostSpace, setPendingGhostSpace] = useState<string | null>(null);

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
    if (propertyId === id) {
      onPropertyChange("");
      onSpacesChange([]);
    } else {
      onPropertyChange(id);
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
    setPendingGhostSpace(spaceName);
    setNewSpaceName(spaceName);
    setShowCreateSpace(true);
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
      onPropertyChange(data.id);
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
    if (!newSpaceName.trim() || !propertyId || !orgId) return;
    
    setCreating(true);
    try {
      await supabase.auth.refreshSession();
      
      const { data, error } = await supabase
        .from("spaces")
        .insert({
          org_id: orgId,
          property_id: propertyId,
          name: newSpaceName.trim(),
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Space created" });
      setNewSpaceName("");
      setPendingGhostSpace(null);
      setShowCreateSpace(false);
      refreshSpaces();
      onSpacesChange([...spaceIds, data.id]);
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
            onClick={() => setShowCreateProperty(true)}
            className="h-6 px-2 text-xs gap-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
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
              <Badge
                key={property.id}
                variant={propertyId === property.id ? "default" : "outline"}
                className={cn(
                  "cursor-pointer font-mono text-xs uppercase transition-all rounded-[5px]",
                  propertyId === property.id && "bg-primary text-primary-foreground"
                )}
                onClick={() => handlePropertySelect(property.id)}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: property.icon_color_hex || '#8EC9CE' }}
                />
                {property.nickname || property.address}
              </Badge>
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
              setNewSpaceName("");
              setShowCreateSpace(true);
            }}
            disabled={!propertyId}
            className="h-6 px-2 text-xs gap-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        {!propertyId ? (
          <p className="text-xs text-muted-foreground py-2">
            Select a property first
          </p>
        ) : spacesLoading ? (
          <p className="text-xs text-muted-foreground">Loading spaces...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Existing spaces */}
            {filteredSpaces.map(space => (
              <Badge
                key={space.id}
                variant={spaceIds.includes(space.id) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer font-mono text-xs uppercase transition-all rounded-[5px]",
                  spaceIds.includes(space.id) && "bg-primary text-primary-foreground"
                )}
                onClick={() => toggleSpace(space.id)}
              >
                {space.icon && <span className="mr-1">{space.icon}</span>}
                {space.name}
              </Badge>
            ))}
            
            {/* Ghost chips for AI suggestions not in DB */}
            {ghostSpaces.map((ghostName, idx) => (
              <Badge
                key={`ghost-${idx}`}
                variant="outline"
                className="cursor-pointer font-mono text-xs uppercase transition-all text-muted-foreground/50 hover:text-muted-foreground border-dashed rounded-[5px]"
                onClick={() => handleGhostSpaceClick(ghostName)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {ghostName}
              </Badge>
            ))}
            
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Property</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Property name or address"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              className="shadow-engraved"
            />
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
        if (!open) setPendingGhostSpace(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingGhostSpace ? `Create "${pendingGhostSpace}"?` : "Create Space"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Space name"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              className="shadow-engraved"
            />
            {pendingGhostSpace && (
              <p className="text-xs text-muted-foreground mt-2">
                This space doesn't exist yet. Create it now?
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateSpace(false);
                setPendingGhostSpace(null);
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
