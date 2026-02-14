/**
 * CreateAssetFromAI — Modal to create asset from AI-detected data
 * Phase 4: User-confirmed asset creation, prefilled from image analysis
 */

import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CreateAssetFromAIPayload {
  name: string;
  category?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  warranty_expiry?: string;
}

const ASSET_CATEGORIES = [
  "Boiler",
  "Appliance",
  "Fire Safety",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Vehicle",
  "Other",
];

interface CreateAssetFromAIProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  propertyId: string;
  spaceId?: string | null;
  attachmentId?: string | null;
  prefilled?: CreateAssetFromAIPayload;
  onAssetCreated?: (assetId: string) => void;
}

export function CreateAssetFromAI({
  open,
  onOpenChange,
  orgId,
  propertyId,
  spaceId,
  attachmentId,
  prefilled,
  onAssetCreated,
}: CreateAssetFromAIProps) {
  const { toast } = useToast();
  const [name, setName] = useState(prefilled?.name || "");
  const [category, setCategory] = useState(prefilled?.category || "");
  const [serialNumber, setSerialNumber] = useState(prefilled?.serial_number || "");
  const [manufacturer, setManufacturer] = useState(prefilled?.manufacturer || "");
  const [model, setModel] = useState(prefilled?.model || "");
  const [warrantyExpiry, setWarrantyExpiry] = useState(prefilled?.warranty_expiry || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && prefilled) {
      setName(prefilled.name || "");
      setCategory(prefilled.category || "");
      setSerialNumber(prefilled.serial_number || "");
      setManufacturer(prefilled.manufacturer || "");
      setModel(prefilled.model || "");
      setWarrantyExpiry(prefilled.warranty_expiry || "");
    }
  }, [open, prefilled]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter an asset name", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-actions-create-asset", {
        body: {
          org_id: orgId,
          property_id: propertyId,
          space_id: spaceId || null,
          name: name.trim(),
          category: category || null,
          serial_number: serialNumber.trim() || null,
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          warranty_expiry: warrantyExpiry.trim() || null,
          detected_from_attachment_id: attachmentId || null,
        },
      });

      if (error) throw error;
      if (!data?.id) throw new Error("No asset returned");

      toast({ title: "Asset created", description: "New asset linked to image" });
      onOpenChange(false);
      onAssetCreated?.(data.id);
    } catch (err: any) {
      toast({
        title: "Failed to create asset",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "rounded-xl bg-surface-gradient",
          "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]",
          "border-0"
        )}
      >
        <DialogHeader>
          <DialogTitle>Create Asset from Image</DialogTitle>
          <DialogDescription>
            Create a new asset using AI-detected details. Edit as needed before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fire Extinguisher"
              className="shadow-engraved"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="asset-category" className="shadow-engraved">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset-serial">Serial Number</Label>
              <Input
                id="asset-serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Serial"
                className="shadow-engraved"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-model">Model</Label>
              <Input
                id="asset-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model"
                className="shadow-engraved"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset-manufacturer">Manufacturer</Label>
              <Input
                id="asset-manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Manufacturer"
                className="shadow-engraved"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-warranty">Warranty / Expiry</Label>
              <Input
                id="asset-warranty"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="shadow-engraved"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="shadow-e1">
            {loading ? "Creating…" : "Create & Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
