/**
 * CreateAssetDialog - Standalone (system-scoped) add asset flow (Assets page, property context).
 * Creates a permanent asset in DB. Create Task uses AssetsSection for asset creation (same permanent entity; entry context is task-scoped).
 */
import { useState } from "react";
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
import { toast } from "sonner";

interface CreateAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onAssetCreated?: () => void;
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
  onAssetCreated,
}: CreateAssetDialogProps) {
  const { orgId } = useActiveOrg();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
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
      // Insert asset - using serial field for name temporarily (matching Assets.tsx pattern)
      // TODO: Add name and type columns to assets table
      const { error: insertError } = await supabase.from("assets").insert({
        org_id: orgId,
        property_id: propertyId,
        serial: name.trim(), // Storing name in serial field (matching existing pattern)
        condition_score: 100, // Default condition score
      } as any); // Type assertion needed until types are regenerated

      if (insertError) {
        console.error("Asset creation error:", insertError);
        throw insertError;
      }

      toast.success("Asset created!");
      
      // Reset form
      setName("");
      setType("");
      setSerialNumber("");
      onOpenChange(false);
      
      // Refresh assets list
      onAssetCreated?.();
    } catch (err: any) {
      console.error("Create asset failed:", err);
      toast.error(err.message || "Failed to create asset");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setName("");
      setType("");
      setSerialNumber("");
      onOpenChange(false);
    }
  };

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

