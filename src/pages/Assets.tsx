import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { useAssets } from "@/hooks/use-assets";
import { useProperties } from "@/hooks/useProperties";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { AssetCard } from "@/components/assets/AssetCard";
import { Card } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Assets = () => {
  const navigate = useNavigate();
  const { assets, loading, error, refresh } = useAssets();
  const { properties } = useProperties();
  const { orgId } = useActiveOrg();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const { spaces } = useSpaces(selectedPropertyId || undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [serial, setSerial] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [conditionScore, setConditionScore] = useState<string>("100");

  const assetTypes = [
    "Boiler",
    "Appliance",
    "Vehicle",
    "HVAC",
    "Plumbing",
    "Electrical",
    "Other",
  ];

  const handlePropertyChange = (value: string) => {
    setPropertyId(value);
    setSelectedPropertyId(value);
    setSpaceId(""); // Reset space when property changes
  };

  const handleSave = async () => {
    if (!orgId || !propertyId) {
      toast.error("Please select a property");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter an asset name");
      return;
    }

    setIsSaving(true);

    try {
      // Note: Currently storing name in serial field until name/type columns are added to schema
      // TODO: Add migration for name and type columns
      const { error: insertError } = await supabase.from("assets").insert({
        org_id: orgId,
        property_id: propertyId,
        space_id: spaceId || null,
        serial: name.trim() || serial || null, // Using name as serial for now
        condition_score: conditionScore ? parseInt(conditionScore, 10) : 100,
      });

      if (insertError) {
        throw insertError;
      }

      toast.success("Asset added successfully");
      setIsDialogOpen(false);
      // Reset form
      setName("");
      setType("");
      setSerial("");
      setPropertyId("");
      setSpaceId("");
      setConditionScore("100");
      setSelectedPropertyId("");
      // Refresh assets list
      refresh();
    } catch (err: any) {
      console.error("Error saving asset:", err);
      toast.error(err.message || "Failed to save asset");
    } finally {
      setIsSaving(false);
    }
  };

  // Create a map of property IDs to names for quick lookup
  const propertyMap = new Map(properties.map((p) => [p.id, p.address]));
  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 bg-card border-b border-border z-40">
          <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto px-4 py-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 bg-card border-b border-border z-40">
          <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto px-4 py-6">
          <p className="text-destructive">Error: {error}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-card border-b border-border z-40">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assets</h1>
            <p className="text-sm text-muted-foreground">{assets.length} assets</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Asset</DialogTitle>
                <DialogDescription>
                  Register a new asset in your property registry
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Main Boiler"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((assetType) => (
                        <SelectItem key={assetType} value={assetType}>
                          {assetType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number</Label>
                  <Input
                    id="serial"
                    placeholder="e.g., ABC123456"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property">Property *</Label>
                  <Select value={propertyId} onValueChange={handlePropertyChange}>
                    <SelectTrigger id="property">
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {propertyId && (
                  <div className="space-y-2">
                    <Label htmlFor="space">Space (Optional)</Label>
                    <Select value={spaceId} onValueChange={setSpaceId}>
                      <SelectTrigger id="space">
                        <SelectValue placeholder="Select a space (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {spaces.map((space) => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition Score (0-100)</Label>
                  <Input
                    id="condition"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="100"
                    value={conditionScore}
                    onChange={(e) => setConditionScore(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !propertyId || !name.trim()}>
                  {isSaving ? "Saving..." : "Save Asset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {assets.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No assets yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first asset to get started
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </Card>
        ) : (
          assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              propertyName={propertyMap.get(asset.property_id)}
              spaceName={asset.space_id ? spaceMap.get(asset.space_id) : undefined}
              onClick={() => {
                // Navigate to asset detail page when implemented
                // navigate(`/assets/${asset.id}`);
              }}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Assets;

