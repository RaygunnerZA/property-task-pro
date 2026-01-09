import { useNavigate } from "react-router-dom";
import { Building2, Home, Hotel, Warehouse, Store, Castle, MapPin, Phone, Mail, Plus, Upload, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

type PropertyRow = Tables<"properties">;

const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

interface PropertyIdentityCardProps {
  property: PropertyRow & {
    owner_name?: string | null;
    owner_email?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  };
  onAddTask?: () => void;
  onAddPhoto?: () => void;
  onMessage?: () => void;
  onCall?: () => void;
}

/**
 * Property Identity Card
 * Compact, sticky card for Column 1 - mirrors dashboard property card style
 */
export function PropertyIdentityCard({
  property,
  onAddTask,
  onAddPhoto,
  onMessage,
  onCall,
}: PropertyIdentityCardProps) {
  const navigate = useNavigate();
  const displayName = property.nickname || property.address;
  const thumbnailUrl = property.thumbnail_url;
  
  // Get property icon
  const iconName = (property as any).icon_name || "home";
  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
  const iconColor = (property as any).icon_color_hex || "#8EC9CE";

  const ownerName = (property as any).owner_name;
  const ownerEmail = (property as any).owner_email;
  const contactName = (property as any).contact_name;
  const contactEmail = (property as any).contact_email;
  const contactPhone = (property as any).contact_phone;

  const handleCall = () => {
    if (contactPhone) {
      window.location.href = `tel:${contactPhone}`;
    } else if (onCall) {
      onCall();
    }
  };

  const handleEmail = () => {
    const email = contactEmail || ownerEmail;
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="bg-card rounded-[8px] overflow-hidden shadow-e1 m-4">
        {/* Square Thumbnail Image */}
        <div 
          className="aspect-square w-full bg-muted overflow-hidden relative"
          style={{
            backgroundColor: thumbnailUrl ? undefined : iconColor,
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <IconComponent className="h-12 w-12 text-white" />
            </div>
          )}
          {/* Neumorphic overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
            }}
          />
        </div>

        {/* Property Info */}
        <div className="p-4 space-y-3">
          {/* Property Name */}
          <div>
            <h2 className="font-semibold text-lg text-foreground leading-tight">
              {displayName}
            </h2>
            {/* Address/Location Chip */}
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{property.address}</span>
            </div>
          </div>

          {/* Owner/Tenant Contact */}
          {(ownerName || ownerEmail || contactName || contactEmail || contactPhone) && (
            <div className="space-y-1.5">
              {ownerName && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs">Owner: </span>
                  <span className="font-medium text-foreground">{ownerName}</span>
                  {ownerEmail && (
                    <span className="text-muted-foreground text-xs ml-1">({ownerEmail})</span>
                  )}
                </div>
              )}
              {contactName && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs">Contact: </span>
                  <span className="font-medium text-foreground">{contactName}</span>
                  {contactEmail && (
                    <span className="text-muted-foreground text-xs ml-1">({contactEmail})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
            {(contactPhone || onCall) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCall}
                className="text-xs"
                disabled={!contactPhone && !onCall}
              >
                <Phone className="h-3 w-3 mr-1.5" />
                Call
              </Button>
            )}
            {((contactEmail || ownerEmail) || onMessage) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onMessage || handleEmail}
                className="text-xs"
                disabled={!contactEmail && !ownerEmail && !onMessage}
              >
                <MessageSquare className="h-3 w-3 mr-1.5" />
                Message
              </Button>
            )}
            {onAddTask && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddTask}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Add Task
              </Button>
            )}
            {onAddPhoto && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddPhoto}
                className="text-xs"
              >
                <Upload className="h-3 w-3 mr-1.5" />
                Add Photo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

