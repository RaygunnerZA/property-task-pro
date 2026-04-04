import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  CheckSquare,
  Package,
  Layers,
  Shield,
  FileText,
  Edit2,
  Check,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { uploadPropertyImageWithThumbnail } from "@/services/properties/propertyImageUpload";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { usePropertyDetails } from "@/hooks/property/usePropertyDetails";

function humanizeSiteType(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export type PropertyForStrip = {
  id: string;
  address: string;
  nickname?: string | null;
  thumbnail_url?: string | null;
  icon_name?: string | null;
  icon_color_hex?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  open_tasks_count?: number | null;
  assets_count?: number | null;
  spaces_count?: number | null;
  expired_compliance_count?: number | null;
  valid_compliance_count?: number | null;
};

const TABS = ["PROPERTY", "DETAILS", "CONTACTS", "MEDIA"] as const;
type TabIndex = 0 | 1 | 2 | 3;

const summaryRowLabelClass =
  "flex w-[100px] shrink-0 items-center gap-2 text-xs text-muted-foreground";
const summaryRowValueClass = "flex-1 min-w-0 text-left text-xs tabular-nums";

interface PropertyIdentityStripProps {
  property: PropertyForStrip;
  onAddTaskClick?: () => void;
  /** Open (non-complete) tasks with priority urgent or high — PROPERTY tab shows ⚠ beside count */
  urgentOpenTaskCount?: number;
}

/**
 * PropertyIdentityStrip
 *
 * A single unified card that replaces the property card(s) in the left column
 * when exactly one property is in focus. The top section is a persistent identity
 * header (sharing visual DNA with PropertyCard). Below it, a tab strip controls
 * which of four sliding content panels is shown:
 *   PROPERTY | DETAILS | CONTACTS | MEDIA
 */
export function PropertyIdentityStrip({
  property,
  onAddTaskClick,
  urgentOpenTaskCount = 0,
}: PropertyIdentityStripProps) {
  const { orgId } = useActiveOrg();
  const { details: propertyDetails } = usePropertyDetails(property.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: complianceList = [] } = useComplianceQuery(property.id);
  const { documents: propertyDocuments = [] } = usePropertyDocuments(property.id, undefined, {
    limit: 500,
  });

  const [activeTab, setActiveTab] = useState<TabIndex>(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Details edit state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    nickname: property.nickname ?? "",
    address: property.address ?? "",
  });

  // Contacts edit state
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [contactsForm, setContactsForm] = useState({
    owner_name: property.owner_name ?? "",
    owner_email: property.owner_email ?? "",
    contact_name: property.contact_name ?? "",
    contact_email: property.contact_email ?? "",
    contact_phone: property.contact_phone ?? "",
  });

  const displayName = property.nickname || property.address;
  const iconColor = property.icon_color_hex || "#8EC9CE";
  const IconComponent = getPropertyChipIcon(property.icon_name);

  const taskCount = property.open_tasks_count ?? 0;
  const assetsCount = property.assets_count ?? 0;
  const spacesCount = property.spaces_count ?? 0;
  const urgentCount = urgentOpenTaskCount;

  const complianceStats = useMemo(() => {
    const expiring = complianceList.filter((c: { expiry_status?: string }) => c.expiry_status === "expiring")
      .length;
    const expired = complianceList.filter((c: { expiry_status?: string }) => c.expiry_status === "expired")
      .length;
    return { total: complianceList.length, expiring, expired };
  }, [complianceList]);

  const documentsCount = propertyDocuments.length;
  const documentsCountLabel = documentsCount >= 500 ? "500+" : String(documentsCount);

  const documentsExpiringCount = useMemo(() => {
    const now = new Date();
    const thirty = new Date(now);
    thirty.setDate(thirty.getDate() + 30);
    const nowStr = now.toISOString().split("T")[0];
    const thirtyStr = thirty.toISOString().split("T")[0];
    return propertyDocuments.filter(
      (d) => d.expiry_date != null && d.expiry_date >= nowStr && d.expiry_date <= thirtyStr
    ).length;
  }, [propertyDocuments]);

  const { data: bedroomCount = 0 } = useQuery({
    queryKey: ["property-bedroom-spaces-count", orgId, property.id],
    queryFn: async () => {
      if (!orgId) return 0;
      const { data, error } = await supabase
        .from("spaces")
        .select("id, space_types(name)")
        .eq("org_id", orgId)
        .eq("property_id", property.id);
      if (error) throw error;
      return (data ?? []).filter((row: { space_types?: { name?: string | null } | null }) => {
        const n = row.space_types?.name?.toLowerCase() ?? "";
        return n.includes("bedroom");
      }).length;
    },
    enabled: !!orgId && !!property.id,
    staleTime: 60_000,
  });

  const identitySubtitle = useMemo(() => {
    const parts: string[] = [];
    if (propertyDetails?.site_type) {
      parts.push(humanizeSiteType(propertyDetails.site_type));
    }
    if (bedroomCount > 0) {
      parts.push(`${bedroomCount} bed`);
    }
    const sqft = propertyDetails?.total_area_sqft;
    if (sqft != null && sqft > 0) {
      const m2 = Math.round(sqft * 0.09290304);
      parts.push(`${m2}m²`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [propertyDetails, bedroomCount]);

  const summaryActionCol =
    "flex h-6 shrink-0 w-[75px] items-center justify-end gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto";

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePhotoEditClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setIsUploadingPhoto(true);
    try {
      await uploadPropertyImageWithThumbnail(supabase, {
        orgId,
        propertyId: property.id,
        file,
      });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (err) {
      console.error("[PropertyIdentityStrip] Photo upload failed:", err);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveDetails = async () => {
    const { error } = await supabase
      .from("properties")
      .update({
        nickname: detailsForm.nickname || null,
        address: detailsForm.address,
      })
      .eq("id", property.id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setIsEditingDetails(false);
    }
  };

  const handleCancelDetails = () => {
    setIsEditingDetails(false);
    setDetailsForm({ nickname: property.nickname ?? "", address: property.address ?? "" });
  };

  const handleSaveContacts = async () => {
    const { error } = await supabase
      .from("properties")
      .update({
        owner_name: contactsForm.owner_name || null,
        owner_email: contactsForm.owner_email || null,
        contact_name: contactsForm.contact_name || null,
        contact_email: contactsForm.contact_email || null,
        contact_phone: contactsForm.contact_phone || null,
      })
      .eq("id", property.id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setIsEditingContacts(false);
    }
  };

  const handleCancelContacts = () => {
    setIsEditingContacts(false);
    setContactsForm({
      owner_name: property.owner_name ?? "",
      owner_email: property.owner_email ?? "",
      contact_name: property.contact_name ?? "",
      contact_email: property.contact_email ?? "",
      contact_phone: property.contact_phone ?? "",
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-card/60 rounded-[12px] overflow-hidden shadow-e1 w-full">

      {/* ── IDENTITY HEADER ──────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: "94px",
          backgroundColor: property.thumbnail_url ? undefined : iconColor,
        }}
      >
        {property.thumbnail_url && (
          <img
            src={property.thumbnail_url}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        )}

        {/* Gradient scrim — ensures name is legible over any photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)",
          }}
        />

        {/* Property icon badge — top left */}
        <div
          className="absolute top-2 left-2 rounded-full flex items-center justify-center z-10 flex-shrink-0"
          style={{
            backgroundColor: iconColor,
            width: "24px",
            height: "24px",
            boxShadow:
              "3px 3px 6px rgba(0,0,0,0.08), -2px -2px 4px rgba(255,255,255,0.5), inset 1px 1px 1px rgba(255,255,255,0.3)",
          }}
        >
          <IconComponent className="h-3.5 w-3.5 text-white" />
        </div>

        {/* Property name + optional facts line — bottom overlay */}
        <div className="absolute bottom-2 left-2.5 right-9 z-10 min-w-0">
          <p className="text-white font-semibold text-[22px] leading-tight truncate drop-shadow-sm">
            {displayName}
          </p>
          {identitySubtitle && (
            <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-white/90 drop-shadow-sm">
              {identitySubtitle}
            </p>
          )}
        </div>

        {/* Edit photo button — bottom right */}
        <button
          type="button"
          onClick={handlePhotoEditClick}
          disabled={isUploadingPhoto}
          className={cn(
            "absolute bottom-2 right-2 z-10",
            "flex items-center justify-center rounded-full",
            "bg-black/30 hover:bg-black/50 backdrop-blur-sm",
            "transition-all duration-200",
            isUploadingPhoto && "opacity-50 cursor-not-allowed"
          )}
          style={{ width: "26px", height: "26px" }}
          aria-label="Change property photo"
        >
          <Camera className="h-3.5 w-3.5 text-white" />
        </button>

        {/* Inset shadow — matches ThumbnailBlock */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow:
              "inset 2px 2px 2px 0px rgba(255,255,255,0.4), inset -1px -1px 2px 0px rgba(0,0,0,0.1)",
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* ── PERFORATION LINE (PropertyCard DNA) ──────────────────────────── */}
      <div
        style={{
          height: "1px",
          backgroundImage:
            "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
          backgroundSize: "7px 1px",
          backgroundRepeat: "repeat-x",
          boxShadow: "1px 1px 0px rgba(255,255,255,1), -1px -1px 1px rgba(0,0,0,0.075)",
        }}
      />

      {/* ── TAB STRIP ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border/30">
        {TABS.map((tab, idx) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(idx as TabIndex)}
            className={cn(
              "flex-1 py-[7px] font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150",
              "focus-visible:outline-none",
              activeTab === idx
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            )}
            style={
              activeTab === idx
                ? { boxShadow: `inset 0 -2px 0 ${iconColor}` }
                : undefined
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── SLIDING CARD CONTENT ─────────────────────────────────────────── */}
      <div className="overflow-hidden" style={{ height: "182px" }}>
        <div
          className="flex transition-transform duration-300 ease-out h-full"
          style={{ transform: `translateX(-${activeTab * 100}%)` }}
        >

          {/* 0 ── SUMMARY ──────────────────────────────────────────────── */}
          <div className="w-full flex-shrink-0 h-full px-1.5 py-2 space-y-0.5 overflow-y-auto">
            {/* Open Tasks */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/properties/${property.id}/tasks`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/properties/${property.id}/tasks`);
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className={summaryRowLabelClass}>
                <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                Open Tasks
              </span>
              <span className={summaryRowValueClass}>
                <span className={cn("font-semibold", taskCount > 0 ? "text-foreground" : "text-muted-foreground")}>
                  {taskCount}
                </span>
                {urgentCount > 0 && (
                  <span
                    className="ml-1 font-medium text-red-600/85"
                    title={`${urgentCount} urgent`}
                    aria-label={`${urgentCount} urgent`}
                  >
                    ⚠
                  </span>
                )}
              </span>
              <div className={summaryActionCol}>
                {onAddTaskClick && (
                  <button
                    type="button"
                    aria-label="Add task"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTaskClick();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                <span
                  className="flex h-6 w-6 items-center justify-center text-xs text-muted-foreground"
                  aria-hidden
                >
                  →
                </span>
              </div>
            </div>

            {/* Assets */}
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                navigate(`/assets?property=${encodeURIComponent(property.id)}`)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/assets?property=${encodeURIComponent(property.id)}`);
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className={summaryRowLabelClass}>
                <Package className="h-3.5 w-3.5 shrink-0" />
                Assets
              </span>
              <span className={cn(summaryRowValueClass, "font-semibold text-foreground")}>{assetsCount}</span>
              <div className={summaryActionCol}>
                <button
                  type="button"
                  aria-label="Add asset"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(
                      `/assets?property=${encodeURIComponent(property.id)}&add=true`
                    );
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span
                  className="flex h-6 w-6 items-center justify-center text-xs text-muted-foreground"
                  aria-hidden
                >
                  →
                </span>
              </div>
            </div>

            {/* Spaces */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/properties/${property.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/properties/${property.id}`);
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className={summaryRowLabelClass}>
                <Layers className="h-3.5 w-3.5 shrink-0" />
                Spaces
              </span>
              <span className={cn(summaryRowValueClass, "font-semibold text-foreground")}>{spacesCount}</span>
              <div className={summaryActionCol}>
                <button
                  type="button"
                  aria-label="Add or organise spaces"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/properties/${property.id}/spaces/organise`);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span
                  className="flex h-6 w-6 items-center justify-center text-xs text-muted-foreground"
                  aria-hidden
                >
                  →
                </span>
              </div>
            </div>

            {/* Compliance */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/properties/${property.id}/compliance`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/properties/${property.id}/compliance`);
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className={summaryRowLabelClass}>
                <Shield className="h-3.5 w-3.5 shrink-0" />
                Compliance
              </span>
              <span className={summaryRowValueClass}>
                {complianceStats.total === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{complianceStats.total}</span>
                    {(complianceStats.expiring > 0 || complianceStats.expired > 0) && (
                      <span
                        className="ml-1 font-medium text-amber-600"
                        title={
                          complianceStats.expired > 0
                            ? `${complianceStats.expired} expired, ${complianceStats.expiring} expiring`
                            : `${complianceStats.expiring} expiring`
                        }
                        aria-label="Has expired or expiring compliance"
                      >
                        ⚠
                      </span>
                    )}
                  </>
                )}
              </span>
              <div className={summaryActionCol}>
                <button
                  type="button"
                  aria-label="Add compliance rule"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/properties/${property.id}/compliance?addRule=1`);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span
                  className="flex h-6 w-6 items-center justify-center text-xs text-muted-foreground"
                  aria-hidden
                >
                  →
                </span>
              </div>
            </div>

            {/* Documents */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/properties/${property.id}/documents`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/properties/${property.id}/documents`);
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className={summaryRowLabelClass}>
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Documents
              </span>
              <span className={summaryRowValueClass}>
                <span className="font-semibold text-foreground">{documentsCountLabel}</span>
                {documentsExpiringCount > 0 && (
                  <>
                    <span className="mx-0.5 text-muted-foreground">•</span>
                    <span className="font-medium text-amber-600">{documentsExpiringCount} expiring</span>
                  </>
                )}
              </span>
              <div className={summaryActionCol}>
                <button
                  type="button"
                  className="rounded-md px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/properties/${property.id}/documents?upload=1`);
                  }}
                >
                  Upload
                </button>
                <span
                  className="flex h-6 w-6 items-center justify-center text-xs text-muted-foreground"
                  aria-hidden
                >
                  →
                </span>
              </div>
            </div>
          </div>

          {/* 1 ── DETAILS ──────────────────────────────────────────────── */}
          <div className="w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto">
            {isEditingDetails ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Nickname
                  </label>
                  <input
                    type="text"
                    value={detailsForm.nickname}
                    onChange={(e) =>
                      setDetailsForm((f) => ({ ...f, nickname: e.target.value }))
                    }
                    placeholder="e.g. The Bird"
                    className="w-full mt-0.5 text-xs bg-background/50 border border-border/50 rounded px-2 py-1.5 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Address
                  </label>
                  <input
                    type="text"
                    value={detailsForm.address}
                    onChange={(e) =>
                      setDetailsForm((f) => ({ ...f, address: e.target.value }))
                    }
                    className="w-full mt-0.5 text-xs bg-background/50 border border-border/50 rounded px-2 py-1.5 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-primary/15 hover:bg-primary/25 text-[11px] font-medium text-primary transition-colors"
                  >
                    <Check className="h-3 w-3" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelDetails}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md hover:bg-muted/50 text-[11px] text-muted-foreground transition-colors"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 flex-1 min-w-0">
                  {property.nickname && property.nickname !== property.address && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Nickname
                      </p>
                      <p className="text-xs font-medium text-foreground truncate">
                        {property.nickname}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Address
                    </p>
                    <p className="text-xs text-foreground/80 leading-snug">
                      {property.address}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingDetails(true)}
                  className="shrink-0 p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Edit details"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2 ── CONTACTS ─────────────────────────────────────────────── */}
          <div className="w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto">
            {isEditingContacts ? (
              <div className="space-y-1.5">
                {(
                  [
                    ["owner_name", "text", "Owner Name"],
                    ["owner_email", "email", "Owner Email"],
                    ["contact_name", "text", "Contact Name"],
                    ["contact_email", "email", "Contact Email"],
                    ["contact_phone", "tel", "Contact Phone"],
                  ] as const
                ).map(([field, type, label]) => (
                  <div key={field}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {label}
                    </label>
                    <input
                      type={type}
                      value={contactsForm[field]}
                      onChange={(e) =>
                        setContactsForm((f) => ({ ...f, [field]: e.target.value }))
                      }
                      className="w-full mt-0.5 text-xs bg-background/50 border border-border/50 rounded px-2 py-1 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleSaveContacts}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-primary/15 hover:bg-primary/25 text-[11px] font-medium text-primary transition-colors"
                  >
                    <Check className="h-3 w-3" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelContacts}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md hover:bg-muted/50 text-[11px] text-muted-foreground transition-colors"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 flex-1 min-w-0">
                  {property.owner_name || property.contact_name ? (
                    <>
                      {property.owner_name && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Owner
                          </p>
                          <p className="text-xs font-medium text-foreground truncate">
                            {property.owner_name}
                          </p>
                          {property.owner_email && (
                            <a
                              href={`mailto:${property.owner_email}`}
                              className="text-[10px] text-primary hover:underline truncate block"
                            >
                              {property.owner_email}
                            </a>
                          )}
                        </div>
                      )}
                      {property.contact_name && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Contact
                          </p>
                          <p className="text-xs font-medium text-foreground truncate">
                            {property.contact_name}
                          </p>
                          {property.contact_phone && (
                            <a
                              href={`tel:${property.contact_phone}`}
                              className="text-[10px] text-primary hover:underline block"
                            >
                              {property.contact_phone}
                            </a>
                          )}
                          {property.contact_email && (
                            <a
                              href={`mailto:${property.contact_email}`}
                              className="text-[10px] text-primary hover:underline block"
                            >
                              {property.contact_email}
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground py-1">No contacts added</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingContacts(true)}
                  className="shrink-0 p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Edit contacts"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 3 ── MEDIA ────────────────────────────────────────────────── */}
          <div className="w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto">
            <div className="space-y-2">
              {property.thumbnail_url ? (
                <div className="relative w-full rounded-lg overflow-hidden" style={{ height: "64px" }}>
                  <img
                    src={property.thumbnail_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-full flex items-center justify-center rounded-lg"
                  style={{ height: "64px", backgroundColor: `${iconColor}20` }}
                >
                  <span className="text-xs text-muted-foreground">No photo yet</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePhotoEditClick}
                  disabled={isUploadingPhoto}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors border border-primary/20 disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {isUploadingPhoto
                    ? "Uploading…"
                    : property.thumbnail_url
                    ? "Replace"
                    : "Add photo"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/properties/${property.id}/photos`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  View all →
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
