/**
 * CreateAssetDialog - Standalone (system-scoped) add asset flow (Assets page, property context).
 * Creates a permanent asset in DB. Create Task uses AssetsSection for asset creation (same permanent entity; entry context is task-scoped).
 * Uses ai_icon_search to infer icon from name + type.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
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
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { toast } from "sonner";

interface CreateAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  spaceId?: string;
  defaultName?: string;
  onAssetCreated?: (assetId: string) => void;
}


const ASSET_TYPES = [
  "Boiler",
  "Appliance",
  "Vehicle",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Other",
];

export function CreateAssetDialog({
  open,
  onOpenChange,
  propertyId,
  spaceId,
  defaultName,
  onAssetCreated,
}: CreateAssetDialogProps) {
  const { orgId } = useActiveOrg();
  const [name, setName] = useState(defaultName || "");
  useEffect(() => {
    if (open && defaultName) setName(defaultName);
  }, [open, defaultName]);
  const [type, setType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [iconName, setIconName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }

    if (!propertyId) {
      toast.error("Property not found");
      return;
    }

    setLoading(true);
    try {

      const { data: inserted, error: insertError } = await supabase
      .from("assets")
      .insert({
        org_id: orgId,
        property_id: propertyId,
        space_id: spaceId || null,
        name: name.trim(),
        asset_type: type || null,
        serial_number: serialNumber.trim() || null,
        condition_score: 100,
        status: "active",
        icon_name: iconName || "box",
      })
      .select("id")
      .single();
    
    if (insertError) {
      console.error("Asset creation error:", insertError);
      throw insertError;
    }
    
    toast.success("Asset created!");

      // Reset form
      setName("");
      setType("");
      setSerialNumber("");
      setIconName("");
      onOpenChange(false);

      // Refresh assets list and/or auto-select new asset
      if (inserted?.id) onAssetCreated?.(inserted.id);
    } catch (err: any) {
      console.error("Create asset failed:", err);
      toast.error(err.message || "Failed to create asset");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName("");
      setType("");
      setSerialNumber("");
      setIconName("");
      onOpenChange(false);
    }
  };

  const searchText = [name, type].filter(Boolean).join(" ").trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
          <DialogDescription>
            Add an asset to this property. The asset will be automatically linked to this property.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Fridge, Boiler, HVAC Unit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType} disabled={loading}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((assetType) => (
                  <SelectItem key={assetType} value={assetType}>
                    {assetType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="serial">Serial Number (optional)</Label>
            <Input
              id="serial"
              placeholder="e.g. SN123456"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* AI Icon + Color (5 each, empty until user types) — assets use icon only; color for future */}
          <AIIconColorPicker
            searchText={searchText}
            value={{ iconName, color: "#8EC9CE" }}
            onChange={(icon) => setIconName(icon)}
            defaultIcons={["package", "box", "wrench", "plug", "cpu"]}
            fallbackSearch="asset"
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

