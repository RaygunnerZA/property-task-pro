import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAssets } from "@/hooks/use-assets";
import { useProperties } from "@/hooks/useProperties";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { AssetCard } from "@/components/assets/AssetCard";
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
import { Button } from "@/components/ui/button";
import { Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StandardPage } from "@/components/design-system/StandardPage";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { EmptyState } from "@/components/design-system/EmptyState";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";

const Assets = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { assets, loading, error, refresh } = useAssets();
  const { properties } = useProperties();
  const { orgId } = useActiveOrg();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const { spaces } = useSpaces(selectedPropertyId || undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check for ?add=true in URL to open dialog
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsDialogOpen(true);
      // Remove the query param from URL
      navigate('/assets', { replace: true });
    }
  }, [searchParams, navigate]);

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
      <StandardPage
        title="Assets"
        icon={<Package className="h-6 w-6" />}
        maxWidth="sm"
      >
        <LoadingState message="Loading assets..." />
      </StandardPage>
    );
  }

  if (error) {
    return (
      <StandardPage
        title="Assets"
        icon={<Package className="h-6 w-6" />}
        maxWidth="sm"
      >
        <ErrorState message={error} onRetry={refresh} />
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title="Assets"
      subtitle={`${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}`}
      icon={<Package className="h-6 w-6" />}
      action={
        <>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <NeomorphicButton>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </NeomorphicButton>
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
                  <NeomorphicInput
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
                    <SelectTrigger id="type" className="input-neomorphic">
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
                  <NeomorphicInput
                    id="serial"
                    placeholder="e.g., ABC123456"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property">Property *</Label>
                  <Select value={propertyId} onValueChange={handlePropertyChange}>
                    <SelectTrigger id="property" className="input-neomorphic">
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
                      <SelectTrigger id="space" className="input-neomorphic">
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
                  <NeomorphicInput
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
                  className="input-neomorphic"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !propertyId || !name.trim()}
                  className="btn-accent-vibrant"
                >
                  {isSaving ? "Saving..." : "Save Asset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      }
        maxWidth="sm"
      >
        {assets.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No assets yet"
            description="Add your first asset to get started"
            action={{
              label: "Add Asset",
              onClick: () => setIsDialogOpen(true),
              icon: Plus
            }}
          />
        ) : (
          <div className="space-y-4">
            {assets.map((asset) => (
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
            ))}
          </div>
        )}
      </StandardPage>
    );
};

export default Assets;

