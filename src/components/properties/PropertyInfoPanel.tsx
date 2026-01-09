import { useState, useEffect } from "react";
import { usePropertyDetails } from "@/hooks/property/usePropertyDetails";
import { usePropertyLegal } from "@/hooks/property/usePropertyLegal";
import { usePropertyUtilities } from "@/hooks/property/usePropertyUtilities";
import { PropertyInfoCard } from "./PropertyInfoCard";
import { PropertyThemesSection } from "./PropertyThemesSection";
import { PropertySpacesSection } from "./PropertySpacesSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Plus, Trash2, Edit, Building2, FileText, Zap, Tags, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PropertyInfoPanelProps {
  propertyId: string;
}

export function PropertyInfoPanel({ propertyId }: PropertyInfoPanelProps) {
  const { details, loading: detailsLoading, updateDetails } = usePropertyDetails(propertyId);
  const { legal, loading: legalLoading, updateLegal } = usePropertyLegal(propertyId);
  const { utilities, loading: utilitiesLoading, createUtility, updateUtility, deleteUtility } = usePropertyUtilities(propertyId);

  // Track expanded sections (allow multiple)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Physical Details State
  const [editingPhysical, setEditingPhysical] = useState(false);
  const [physicalForm, setPhysicalForm] = useState({
    total_area_sqft: details?.total_area_sqft?.toString() || "",
    floor_count: details?.floor_count?.toString() || "",
    site_type: details?.site_type || "",
    ownership_type: details?.ownership_type || "",
    listing_grade: details?.listing_grade || "",
  });

  // Legal Details State
  const [editingLegal, setEditingLegal] = useState(false);
  const [legalForm, setLegalForm] = useState({
    purchase_date: legal?.purchase_date || "",
    lease_start: legal?.lease_start || "",
    lease_end: legal?.lease_end || "",
    landlord_name: legal?.landlord_name || "",
    agent_contact_name: (legal?.agent_contact as any)?.name || "",
    agent_contact_email: (legal?.agent_contact as any)?.email || "",
    agent_contact_phone: (legal?.agent_contact as any)?.phone || "",
  });

  // Utilities State
  const [editingUtility, setEditingUtility] = useState<string | null>(null);
  const [newUtility, setNewUtility] = useState(false);
  const [utilityForm, setUtilityForm] = useState({
    type: "elec" as "elec" | "gas" | "water",
    supplier: "",
    meter_serial: "",
    account_number: "",
  });

  // Initialize forms when data loads
  useEffect(() => {
    if (details && !editingPhysical) {
      setPhysicalForm({
        total_area_sqft: details.total_area_sqft?.toString() || "",
        floor_count: details.floor_count?.toString() || "",
        site_type: details.site_type || "",
        ownership_type: details.ownership_type || "",
        listing_grade: details.listing_grade || "",
      });
    }
  }, [details, editingPhysical]);

  useEffect(() => {
    if (legal && !editingLegal) {
      setLegalForm({
        purchase_date: legal.purchase_date || "",
        lease_start: legal.lease_start || "",
        lease_end: legal.lease_end || "",
        landlord_name: legal.landlord_name || "",
        agent_contact_name: (legal.agent_contact as any)?.name || "",
        agent_contact_email: (legal.agent_contact as any)?.email || "",
        agent_contact_phone: (legal.agent_contact as any)?.phone || "",
      });
    }
  }, [legal, editingLegal]);

  const handleSavePhysical = async () => {
    const result = await updateDetails({
      total_area_sqft: physicalForm.total_area_sqft ? parseInt(physicalForm.total_area_sqft) : null,
      floor_count: physicalForm.floor_count ? parseInt(physicalForm.floor_count) : null,
      site_type: physicalForm.site_type || null,
      ownership_type: physicalForm.ownership_type || null,
      listing_grade: physicalForm.listing_grade || null,
    });

    if (result.error) {
      toast.error("Failed to save physical details");
    } else {
      toast.success("Physical details saved");
      setEditingPhysical(false);
    }
  };

  const handleCancelPhysical = () => {
    if (details) {
      setPhysicalForm({
        total_area_sqft: details.total_area_sqft?.toString() || "",
        floor_count: details.floor_count?.toString() || "",
        site_type: details.site_type || "",
        ownership_type: details.ownership_type || "",
        listing_grade: details.listing_grade || "",
      });
    }
    setEditingPhysical(false);
  };

  const handleSaveLegal = async () => {
    const agent_contact = {
      name: legalForm.agent_contact_name || undefined,
      email: legalForm.agent_contact_email || undefined,
      phone: legalForm.agent_contact_phone || undefined,
    };

    Object.keys(agent_contact).forEach((key) => {
      if ((agent_contact as any)[key] === undefined) {
        delete (agent_contact as any)[key];
      }
    });

    const result = await updateLegal({
      purchase_date: legalForm.purchase_date || null,
      lease_start: legalForm.lease_start || null,
      lease_end: legalForm.lease_end || null,
      landlord_name: legalForm.landlord_name || null,
      agent_contact: Object.keys(agent_contact).length > 0 ? agent_contact : null,
    });

    if (result.error) {
      toast.error("Failed to save legal details");
    } else {
      toast.success("Legal details saved");
      setEditingLegal(false);
    }
  };

  const handleCancelLegal = () => {
    if (legal) {
      setLegalForm({
        purchase_date: legal.purchase_date || "",
        lease_start: legal.lease_start || "",
        lease_end: legal.lease_end || "",
        landlord_name: legal.landlord_name || "",
        agent_contact_name: (legal.agent_contact as any)?.name || "",
        agent_contact_email: (legal.agent_contact as any)?.email || "",
        agent_contact_phone: (legal.agent_contact as any)?.phone || "",
      });
    }
    setEditingLegal(false);
  };

  const handleSaveUtility = async (utilityId?: string) => {
    if (utilityId) {
      const utility = utilities.find((u) => u.id === utilityId);
      if (!utility) return;

      const result = await updateUtility(utilityId, {
        type: utilityForm.type,
        supplier: utilityForm.supplier || null,
        meter_serial: utilityForm.meter_serial || null,
        account_number: utilityForm.account_number || null,
      });

      if (result.error) {
        toast.error("Failed to update utility");
      } else {
        toast.success("Utility updated");
        setEditingUtility(null);
        setUtilityForm({ type: "elec", supplier: "", meter_serial: "", account_number: "" });
      }
    } else {
      const result = await createUtility({
        type: utilityForm.type,
        supplier: utilityForm.supplier || null,
        meter_serial: utilityForm.meter_serial || null,
        account_number: utilityForm.account_number || null,
      } as any);

      if (result.error) {
        toast.error("Failed to create utility");
      } else {
        toast.success("Utility added");
        setNewUtility(false);
        setUtilityForm({ type: "elec", supplier: "", meter_serial: "", account_number: "" });
      }
    }
  };

  const handleDeleteUtility = async (utilityId: string) => {
    if (!confirm("Are you sure you want to delete this utility?")) return;

    const result = await deleteUtility(utilityId);
    if (result.error) {
      toast.error("Failed to delete utility");
    } else {
      toast.success("Utility deleted");
    }
  };

  const startEditUtility = (utilityId: string) => {
    const utility = utilities.find((u) => u.id === utilityId);
    if (utility) {
      setUtilityForm({
        type: utility.type as "elec" | "gas" | "water",
        supplier: utility.supplier || "",
        meter_serial: utility.meter_serial || "",
        account_number: utility.account_number || "",
      });
      setEditingUtility(utilityId);
    }
  };

  if (detailsLoading || legalLoading || utilitiesLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading property information...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Physical Details Card */}
      <PropertyInfoCard
        title="Physical Details"
        icon={Building2}
        isExpanded={expandedSections.has("physical")}
        onToggle={() => toggleSection("physical")}
      >
        {editingPhysical ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_area_sqft">Total Area (sqft)</Label>
                <Input
                  id="total_area_sqft"
                  type="number"
                  value={physicalForm.total_area_sqft}
                  onChange={(e) => setPhysicalForm({ ...physicalForm, total_area_sqft: e.target.value })}
                  placeholder="2500"
                  className="input-neomorphic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor_count">Floor Count</Label>
                <Input
                  id="floor_count"
                  type="number"
                  value={physicalForm.floor_count}
                  onChange={(e) => setPhysicalForm({ ...physicalForm, floor_count: e.target.value })}
                  placeholder="2"
                  className="input-neomorphic"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_type">Site Type</Label>
              <Select
                value={physicalForm.site_type}
                onValueChange={(value) => setPhysicalForm({ ...physicalForm, site_type: value })}
              >
                <SelectTrigger className="input-neomorphic">
                  <SelectValue placeholder="Select site type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="mixed_use">Mixed Use</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="land">Land</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownership_type">Ownership Type</Label>
              <Select
                value={physicalForm.ownership_type}
                onValueChange={(value) => setPhysicalForm({ ...physicalForm, ownership_type: value })}
              >
                <SelectTrigger className="input-neomorphic">
                  <SelectValue placeholder="Select ownership type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owned">Owned</SelectItem>
                  <SelectItem value="leased">Leased</SelectItem>
                  <SelectItem value="rented">Rented</SelectItem>
                  <SelectItem value="managed">Managed</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing_grade">Listing Grade</Label>
              <Input
                id="listing_grade"
                value={physicalForm.listing_grade}
                onChange={(e) => setPhysicalForm({ ...physicalForm, listing_grade: e.target.value })}
                placeholder="A, B, C, etc."
                className="input-neomorphic"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSavePhysical} className="btn-neomorphic">
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelPhysical}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Total Area</div>
                <div className="font-medium">{details?.total_area_sqft ? `${details.total_area_sqft} sqft` : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Floors</div>
                <div className="font-medium">{details?.floor_count || "—"}</div>
              </div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Site Type</div>
              <div className="font-medium capitalize">{details?.site_type || "—"}</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Ownership</div>
              <div className="font-medium capitalize">{details?.ownership_type || "—"}</div>
            </div>
            {details?.listing_grade && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">Listing Grade</div>
                <div className="font-medium">{details.listing_grade}</div>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setEditingPhysical(true);
              }}
              className="mt-2"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </PropertyInfoCard>

      {/* Legal & Lease Card */}
      <PropertyInfoCard
        title="Legal & Lease"
        icon={FileText}
        isExpanded={expandedSections.has("legal")}
        onToggle={() => toggleSection("legal")}
      >
        {editingLegal ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={legalForm.purchase_date}
                  onChange={(e) => setLegalForm({ ...legalForm, purchase_date: e.target.value })}
                  className="input-neomorphic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lease_start">Lease Start</Label>
                <Input
                  id="lease_start"
                  type="date"
                  value={legalForm.lease_start}
                  onChange={(e) => setLegalForm({ ...legalForm, lease_start: e.target.value })}
                  className="input-neomorphic"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lease_end">Lease End</Label>
              <Input
                id="lease_end"
                type="date"
                value={legalForm.lease_end}
                onChange={(e) => setLegalForm({ ...legalForm, lease_end: e.target.value })}
                className="input-neomorphic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landlord_name">Landlord Name</Label>
              <Input
                id="landlord_name"
                value={legalForm.landlord_name}
                onChange={(e) => setLegalForm({ ...legalForm, landlord_name: e.target.value })}
                placeholder="Landlord name"
                className="input-neomorphic"
              />
            </div>
            <div className="space-y-2">
              <Label>Agent Contact</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Agent name"
                  value={legalForm.agent_contact_name}
                  onChange={(e) => setLegalForm({ ...legalForm, agent_contact_name: e.target.value })}
                  className="input-neomorphic"
                />
                <Input
                  type="email"
                  placeholder="Agent email"
                  value={legalForm.agent_contact_email}
                  onChange={(e) => setLegalForm({ ...legalForm, agent_contact_email: e.target.value })}
                  className="input-neomorphic"
                />
                <Input
                  type="tel"
                  placeholder="Agent phone"
                  value={legalForm.agent_contact_phone}
                  onChange={(e) => setLegalForm({ ...legalForm, agent_contact_phone: e.target.value })}
                  className="input-neomorphic"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveLegal} className="btn-neomorphic">
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelLegal}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Purchase Date</div>
                <div className="font-medium">{legal?.purchase_date || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Lease Start</div>
                <div className="font-medium">{legal?.lease_start || "—"}</div>
              </div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Lease End</div>
              <div className="font-medium">{legal?.lease_end || "—"}</div>
            </div>
            {legal?.landlord_name && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">Landlord</div>
                <div className="font-medium">{legal.landlord_name}</div>
              </div>
            )}
            {legal?.agent_contact && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">Agent Contact</div>
                <div className="font-medium">
                  {(legal.agent_contact as any)?.name && <div>{(legal.agent_contact as any).name}</div>}
                  {(legal.agent_contact as any)?.email && <div className="text-muted-foreground">{(legal.agent_contact as any).email}</div>}
                  {(legal.agent_contact as any)?.phone && <div className="text-muted-foreground">{(legal.agent_contact as any).phone}</div>}
                </div>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setEditingLegal(true);
              }}
              className="mt-2"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </PropertyInfoCard>

      {/* Utilities Card */}
      <PropertyInfoCard
        title="Utilities"
        icon={Zap}
        isExpanded={expandedSections.has("utilities")}
        onToggle={() => toggleSection("utilities")}
      >
        <div className="space-y-4">
          {utilities.map((utility) => (
            <div
              key={utility.id}
              className="p-4 rounded-lg border border-border/50 bg-card shadow-e1"
            >
              {editingUtility === utility.id ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={utilityForm.type}
                      onValueChange={(value: "elec" | "gas" | "water") =>
                        setUtilityForm({ ...utilityForm, type: value })
                      }
                    >
                      <SelectTrigger className="input-neomorphic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elec">Electric</SelectItem>
                        <SelectItem value="gas">Gas</SelectItem>
                        <SelectItem value="water">Water</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Input
                      value={utilityForm.supplier}
                      onChange={(e) => setUtilityForm({ ...utilityForm, supplier: e.target.value })}
                      placeholder="Supplier name"
                      className="input-neomorphic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meter Serial</Label>
                    <Input
                      value={utilityForm.meter_serial}
                      onChange={(e) => setUtilityForm({ ...utilityForm, meter_serial: e.target.value })}
                      placeholder="Meter serial number"
                      className="input-neomorphic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={utilityForm.account_number}
                      onChange={(e) => setUtilityForm({ ...utilityForm, account_number: e.target.value })}
                      placeholder="Account number"
                      className="input-neomorphic"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveUtility(utility.id)} className="btn-neomorphic">
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingUtility(null);
                        setUtilityForm({ type: "elec", supplier: "", meter_serial: "", account_number: "" });
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold capitalize">{utility.type}</div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditUtility(utility.id);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUtility(utility.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {utility.supplier && (
                    <div className="text-sm text-muted-foreground">Supplier: {utility.supplier}</div>
                  )}
                  {utility.meter_serial && (
                    <div className="text-sm text-muted-foreground">Meter: {utility.meter_serial}</div>
                  )}
                  {utility.account_number && (
                    <div className="text-sm text-muted-foreground">Account: {utility.account_number}</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {newUtility ? (
            <div className="p-4 rounded-lg border border-border/50 bg-card shadow-e1">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={utilityForm.type}
                    onValueChange={(value: "elec" | "gas" | "water") =>
                      setUtilityForm({ ...utilityForm, type: value })
                    }
                  >
                    <SelectTrigger className="input-neomorphic">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elec">Electric</SelectItem>
                      <SelectItem value="gas">Gas</SelectItem>
                      <SelectItem value="water">Water</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input
                    value={utilityForm.supplier}
                    onChange={(e) => setUtilityForm({ ...utilityForm, supplier: e.target.value })}
                    placeholder="Supplier name"
                    className="input-neomorphic"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meter Serial</Label>
                  <Input
                    value={utilityForm.meter_serial}
                    onChange={(e) => setUtilityForm({ ...utilityForm, meter_serial: e.target.value })}
                    placeholder="Meter serial number"
                    className="input-neomorphic"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={utilityForm.account_number}
                    onChange={(e) => setUtilityForm({ ...utilityForm, account_number: e.target.value })}
                    placeholder="Account number"
                    className="input-neomorphic"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveUtility()} className="btn-neomorphic">
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewUtility(false);
                      setUtilityForm({ type: "elec", supplier: "", meter_serial: "", account_number: "" });
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setNewUtility(true);
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Utility
            </Button>
          )}
        </div>
      </PropertyInfoCard>

      {/* Themes Card */}
      <PropertyInfoCard
        title="Themes"
        icon={Tags}
        isExpanded={expandedSections.has("themes")}
        onToggle={() => toggleSection("themes")}
      >
        <PropertyThemesSection propertyId={propertyId} />
      </PropertyInfoCard>

      {/* Spaces Card */}
      <PropertyInfoCard
        title="Spaces"
        icon={LayoutGrid}
        isExpanded={expandedSections.has("spaces")}
        onToggle={() => toggleSection("spaces")}
      >
        <PropertySpacesSection propertyId={propertyId} />
      </PropertyInfoCard>
    </div>
  );
}
