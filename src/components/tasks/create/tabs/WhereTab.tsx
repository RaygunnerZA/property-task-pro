import { Building2, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProperties } from "@/hooks/useProperties";
import { useSpaces } from "@/hooks/useSpaces";
import { cn } from "@/lib/utils";

interface WhereTabProps {
  propertyId: string;
  spaceIds: string[];
  onPropertyChange: (propertyId: string) => void;
  onSpacesChange: (spaceIds: string[]) => void;
}

export function WhereTab({ 
  propertyId, 
  spaceIds, 
  onPropertyChange, 
  onSpacesChange 
}: WhereTabProps) {
  const { properties } = useProperties();
  const { spaces } = useSpaces(propertyId || undefined);

  const handlePropertyChange = (newPropertyId: string) => {
    onPropertyChange(newPropertyId);
    onSpacesChange([]); // Reset spaces when property changes
  };

  const toggleSpace = (spaceId: string) => {
    if (spaceIds.includes(spaceId)) {
      onSpacesChange(spaceIds.filter(id => id !== spaceId));
    } else {
      onSpacesChange([...spaceIds, spaceId]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Property Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Property
        </Label>
        <Select value={propertyId} onValueChange={handlePropertyChange}>
          <SelectTrigger className="shadow-engraved">
            <SelectValue placeholder="Select a property" />
          </SelectTrigger>
          <SelectContent>
            {properties.map(property => (
              <SelectItem key={property.id} value={property.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: property.icon_color_hex || '#8EC9CE' }}
                  />
                  {property.nickname || property.address}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Space Selection */}
      {propertyId && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Spaces
          </Label>
          {spaces.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {spaces.map(space => (
                <Badge
                  key={space.id}
                  variant={spaceIds.includes(space.id) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer font-mono text-xs uppercase transition-all",
                    spaceIds.includes(space.id) && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => toggleSpace(space.id)}
                >
                  {space.icon && <span className="mr-1">{space.icon}</span>}
                  {space.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No spaces found for this property
            </p>
          )}
        </div>
      )}

      {!propertyId && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Select a property to choose spaces
        </p>
      )}
    </div>
  );
}
