import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useFileUpload } from "@/hooks/useFileUpload";
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
import { toast } from "sonner";
import {
  Building2,
  Home,
  Hotel,
  Warehouse,
  Store,
  Castle,
  Upload,
  X,
} from "lucide-react";

const PROPERTY_ICONS = [
  { name: "home", icon: Home, label: "Home" },
  { name: "building", icon: Building2, label: "Building" },
  { name: "hotel", icon: Hotel, label: "Hotel" },
  { name: "warehouse", icon: Warehouse, label: "Warehouse" },
  { name: "store", icon: Store, label: "Store" },
  { name: "castle", icon: Castle, label: "Castle" },
];

const PROPERTY_COLORS = [
  "#FF6B6B", // Coral
  "#4ECDC4", // Teal
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
];

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPropertyDialog({ open, onOpenChange }: AddPropertyDialogProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [nickname, setNickname] = useState("");
  const [iconName, setIconName] = useState("building");
  const [iconColor, setIconColor] = useState("#FF6B6B");
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPropertyImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setPropertyImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!address.trim() && !nickname.trim()) {
      toast.error("Property name or address is required");
      return;
    }

    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }

    setLoading(true);
    try {
      // Use nickname as address if address is empty
      const finalAddress = address.trim() || nickname.trim() || "No address provided";

      // Check for duplicate property address within this org
      const { data: existingProperties, error: checkError } = await supabase
        .from("properties")
        .select("id, address")
        .eq("org_id", orgId)
        .ilike("address", finalAddress);

      if (checkError) {
        console.error("Error checking duplicates:", checkError);
      } else if (existingProperties && existingProperties.length > 0) {
        toast.error("A property with this address already exists");
        setLoading(false);
        return;
      }

      // Create property first (without image)
      const { data: newProperty, error: createError } = await supabase.rpc("create_property_v2", {
        p_org_id: orgId,
        p_address: finalAddress,
        p_nickname: nickname.trim() || null,
        p_icon_name: iconName,
        p_icon_color_hex: iconColor,
        p_thumbnail_url: null, // Will be set after thumbnail generation
      });

      if (createError) {
        console.error("Property creation error:", createError);
        throw createError;
      }

      if (!newProperty) {
        throw new Error("Failed to create property: no data returned");
      }

      const propertyId = (newProperty as any).id;

      // Upload image with automatic thumbnail generation if provided
      if (propertyImage && propertyId) {
        try {
          const fileExt = propertyImage.name.split(".").pop();
          const fileName = `${orgId}/${propertyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          // Upload file first
          const { error: uploadError } = await supabase.storage
            .from("property-images")
            .upload(fileName, propertyImage);

          if (uploadError) {
            console.error("Image upload error:", uploadError);
            toast.warning("Property created but image upload failed");
          } else {
            // Trigger thumbnail generation via edge function
            const { error: processError } = await supabase.functions.invoke(
              "process-image",
              {
                body: {
                  bucket: "property-images",
                  path: fileName,
                  recordId: propertyId,
                  table: "properties",
                },
              }
            );

            if (processError) {
              console.error("Thumbnail generation failed:", processError);
              // Property was created and image uploaded, just thumbnail generation failed
            }
          }
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
          // Continue - property was created successfully
          toast.warning("Property created but image upload failed");
        }
      }

      toast.success("Property created!");
      // Reset form
      setAddress("");
      setNickname("");
      setIconName("building");
      setIconColor("#FF6B6B");
      setPropertyImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (err: any) {
      console.error("Create property failed:", err);
      toast.error(err.message || "Failed to create property");
    } finally {
      setLoading(false);
    }
  };

  const SelectedIcon = PROPERTY_ICONS.find((i) => i.name === iconName)?.icon || Building2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Enter the property details below.
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
              <SelectedIcon className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <Label className="mb-2 block">Choose an icon</Label>
            <div className="flex justify-center gap-3 flex-wrap">
              {PROPERTY_ICONS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIconName(name)}
                  disabled={loading}
                  className={`p-3 rounded-xl transition-all duration-200 ${
                    iconName === name
                      ? "bg-white shadow-lg scale-110"
                      : "bg-muted hover:bg-white"
                  }`}
                  style={{
                    boxShadow:
                      iconName === name
                        ? "2px 2px 6px rgba(0,0,0,0.15), -1px -1px 4px rgba(255,255,255,0.5)"
                        : "inset 1px 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{
                      color: iconName === name ? iconColor : "#6D7480",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <Label className="mb-2 block">Choose a color</Label>
            <div className="flex justify-center gap-3 flex-wrap">
              {PROPERTY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setIconColor(color)}
                  disabled={loading}
                  className={`w-8 h-8 rounded-full transition-all duration-200 ${
                    iconColor === color
                      ? "scale-125 ring-2 ring-offset-2 ring-gray-400"
                      : ""
                  }`}
                  style={{
                    backgroundColor: color,
                    boxShadow:
                      "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 3px rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <Label className="mb-2 block">Property photo (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={loading}
            />
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Property preview"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={loading}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full py-4 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors flex flex-col items-center gap-2 bg-muted/30"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Tap to upload photo
                </span>
              </button>
            )}
          </div>

          {/* Property Name */}
          <div className="grid gap-2">
            <Label htmlFor="nickname">Property name *</Label>
            <Input
              id="nickname"
              placeholder="The Grand Hotel"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Address */}
          <div className="grid gap-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              placeholder="123 Main St, City, State ZIP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              // Reset form when closing
              setAddress("");
              setNickname("");
              setIconName("building");
              setIconColor("#FF6B6B");
              setPropertyImage(null);
              setImagePreview(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || (!address.trim() && !nickname.trim())}
          >
            {loading ? "Creating..." : "Create Property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

