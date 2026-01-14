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
        {/* Property Info */}
        <div className="p-4 space-y-3">
          {/* Contact Title */}
          <div>
            <h2 className="font-semibold text-lg text-foreground leading-tight">
              Contact
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

          {/* Quick Actions - Icon Only */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            {(contactPhone || onCall) && (
              <button
                onClick={handleCall}
                className="p-2 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!contactPhone && !onCall}
                aria-label="Call"
              >
                <Phone className="h-4 w-4" />
              </button>
            )}
            {((contactEmail || ownerEmail) || onMessage) && (
              <button
                onClick={onMessage || handleEmail}
                className="p-2 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!contactEmail && !ownerEmail && !onMessage}
                aria-label="Message"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            {(contactEmail || ownerEmail) && (
              <button
                onClick={handleEmail}
                className="p-2 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

