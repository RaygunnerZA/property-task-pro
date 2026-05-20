import { useState, useRef, useMemo, useCallback, useEffect, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  FileText,
  Edit2,
  Check,
  X,
  Plus,
  Upload,
  Archive,
  ChevronsUp,
  ChevronsDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getWeatherLucideIcon } from "@/lib/weatherIcon";
import {
  propertyHubPath,
  propertySubPath,
  WORKBENCH_ISSUES_FILTER_QUERY,
  WORKBENCH_TASK_PRIORITY_QUERY,
} from "@/lib/propertyRoutes";
import { uploadPropertyImageWithThumbnail } from "@/services/properties/propertyImageUpload";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { usePropertyDetails } from "@/hooks/property/usePropertyDetails";
import { usePropertyTimeline } from "@/hooks/property/usePropertyTimeline";
import { usePropertyVendors } from "@/hooks/property/usePropertyVendors";
import { usePropertyDrift } from "@/hooks/property/usePropertyDrift";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { PropertySummaryDashboardGrid } from "@/components/properties/PropertySummaryDashboardGrid";
import type { PropertyCardWeather } from "@/types/propertyCardWeather";
import { propertiesService } from "@/services/properties/properties";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

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

const TABS = ["PROPERTY", "DETAILS", "CONTACTS", "MEDIA", "TIMELINE", "VENDORS", "DRIFT"] as const;
type TabIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Right-edge fade: solid muted band fading to transparent at the left. */
const TAB_STRIP_RIGHT_FADE_STYLE: CSSProperties = {
  background:
    "linear-gradient(270deg, rgba(237, 235, 232, 1) 0%, rgba(237, 235, 232, 1) 32%, rgba(0, 0, 0, 0) 100%)",
};

type AssetViewRow = {
  status?: string | null;
  condition_score?: number | null;
  open_tasks_count?: number | null;
};

interface PropertyIdentityStripProps {
  property: PropertyForStrip;
  onAddTaskClick?: () => void;
  /** Open tasks with priority urgent or high — shown as `total • urgent ⚠` on PROPERTY tab */
  urgentOpenTaskCount?: number;
  /** Called after a successful archive (e.g. reset hub selection to all properties). */
  onPropertyArchived?: () => void;
  /** Hub workbench: open the centre Tasks tab instead of navigating away. */
  onOpenTasksClick?: () => void;
  /** Hub workbench: urgent / attention slices (`show-tasks-urgent`, `show-spaces-urgent`, `show-assets-attention`). */
  onFilterClick?: (filterId: string) => void;
  /** When provided (single-property workbench), Today + weather render on the thumbnail; parent hides the gradient header row. */
  propertyCardWeather?: PropertyCardWeather;
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
  onPropertyArchived,
  onOpenTasksClick,
  onFilterClick,
  propertyCardWeather,
}: PropertyIdentityStripProps) {
  const { orgId } = useActiveOrg();
  const { details: propertyDetails } = usePropertyDetails(property.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { documents: propertyDocuments = [] } = usePropertyDocuments(property.id, undefined, {
    limit: 500,
  });
  const { data: propertyAssets = [] } = useAssetsQuery(property.id);
  const { data: propertyTasksView = [] } = useTasksQuery(property.id);

  const { events: timelineEvents, isLoading: timelineLoading } = usePropertyTimeline(property.id);
  const { vendorActivity, isLoading: vendorsLoading } = usePropertyVendors(property.id);
  const { drift, isLoading: driftLoading } = usePropertyDrift(property.id);

  const [activeTab, setActiveTab] = useState<TabIndex>(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [showTabStripRightFade, setShowTabStripRightFade] = useState(false);

  const updateTabStripFade = useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
    setShowTabStripRightFade(overflow && !atEnd);
  }, []);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    updateTabStripFade();
    const ro = new ResizeObserver(() => updateTabStripFade());
    ro.observe(el);
    el.addEventListener("scroll", updateTabStripFade, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateTabStripFade);
    };
  }, [updateTabStripFade]);

  const scrollTabsRight = useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: Math.max(72, el.clientWidth * 0.55), behavior: "smooth" });
  }, []);

  // Details edit state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    nickname: property.nickname ?? "",
    address: property.address ?? "",
  });

  // Contacts edit state
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [showArchivePropertyDialog, setShowArchivePropertyDialog] = useState(false);
  const [isArchivingProperty, setIsArchivingProperty] = useState(false);
  /** Hides tab panels (all tabs) until expanded again — state is shared across PROPERTY / DETAILS / CONTACTS / MEDIA. */
  const [isBelowTabsCollapsed, setIsBelowTabsCollapsed] = useState(false);
  const [isBelowTabsHovered, setIsBelowTabsHovered] = useState(false);
  const isMobile = useIsMobile();
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
  const WeatherIcon = getWeatherLucideIcon(propertyCardWeather?.conditionCode ?? null);

  const taskCount = property.open_tasks_count ?? 0;
  const assetsCount = property.assets_count ?? 0;
  const spacesCount = property.spaces_count ?? 0;
  const urgentCount = urgentOpenTaskCount;

  const assetsAttentionCount = useMemo(() => {
    return (propertyAssets as AssetViewRow[]).filter((a) => {
      const active = (a.status || "active") === "active";
      if (!active) return false;
      const score = a.condition_score ?? 100;
      const openTasks = a.open_tasks_count ?? 0;
      return score < 60 || openTasks > 0;
    }).length;
  }, [propertyAssets]);

  const documentsCount = propertyDocuments.length;
  const documentsCountLabel = documentsCount >= 500 ? "500+" : String(documentsCount);

  const taskDashboardMetrics = useMemo(() => {
    const list = propertyTasksView as Record<string, unknown>[];
    const isCompleted = (t: Record<string, unknown>) =>
      String(t?.status ?? "").toLowerCase() === "completed";
    const isArchived = (t: Record<string, unknown>) =>
      String(t?.status ?? "").toLowerCase() === "archived";
    const active = list.filter((t) => !isArchived(t));
    const total = active.length;
    const done = active.filter(isCompleted).length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    const parseSpaces = (t: Record<string, unknown>): { id?: string }[] => {
      try {
        const raw = t.spaces;
        const s = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
        return Array.isArray(s) ? s : [];
      } catch {
        return [];
      }
    };

    const spaceIdsWithUrgent = new Set<string>();
    for (const t of list) {
      const st = String(t.status ?? "").toLowerCase();
      if (st === "completed" || st === "archived") continue;
      const pr = String(t.priority ?? "").toLowerCase();
      if (pr !== "urgent" && pr !== "high") continue;
      for (const s of parseSpaces(t)) {
        if (s?.id) spaceIdsWithUrgent.add(s.id);
      }
    }

    return {
      completionPct,
      completedLabel: `${done} of ${total} complete`,
      spacesWithUrgentIssueCount: spaceIdsWithUrgent.size,
    };
  }, [propertyTasksView]);

  const documentDashboardBuckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().split("T")[0];
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().split("T")[0];

    let dueSoon = 0;
    let expiring = 0;
    let missing = 0;

    for (const d of propertyDocuments) {
      if (!d.file_url) {
        missing++;
        continue;
      }
      const exp = d.expiry_date;
      if (!exp) continue;
      if (exp < todayStr || exp <= in7Str) expiring++;
      else if (exp <= in30Str) dueSoon++;
    }

    return { dueSoon, expiring, missing };
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

  const handleConfirmArchiveProperty = async () => {
    setIsArchivingProperty(true);
    const { error } = await propertiesService.archiveProperty(property.id);
    setIsArchivingProperty(false);
    if (error) {
      toast.error("Couldn't archive property", { description: error });
      return;
    }
    setShowArchivePropertyDialog(false);
    toast.success("Property archived", {
      description: `${displayName} is no longer shown in your active list.`,
    });
    await queryClient.invalidateQueries({ queryKey: ["properties"] });
    onPropertyArchived?.();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const collapseStripPx = 30;
  const cardHeightExpanded = 438;
  const cardHeightWithStrip = cardHeightExpanded + collapseStripPx;
  const cardHeightCollapsed = 230;
  const showCollapseStrip =
    !isBelowTabsCollapsed && (isMobile || isBelowTabsHovered);
  const cardHeightPx = isBelowTabsCollapsed
    ? cardHeightCollapsed
    : showCollapseStrip
      ? cardHeightWithStrip
      : cardHeightExpanded;

  return (
    <div
      className="bg-card/60 rounded-[12px] overflow-hidden border border-border/20 shadow-[1px_1px_2px_0px_rgba(0,0,0,0.05),inset_1px_1px_1px_0px_rgba(255,255,255,0.65)] w-full flex flex-col pl-0 pr-0 transition-[height,box-shadow] duration-300 ease-out"
      style={{ height: `${cardHeightPx}px`, paddingLeft: 0, paddingRight: 0 }}
    >

      {/* ── IDENTITY HEADER ──────────────────────────────────────────────── */}
      <div
        className="group relative w-full shrink-0 overflow-hidden"
        style={{
          height: "144px",
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
          className="absolute left-0 right-0 top-0 h-[146px] pointer-events-none"
          style={{
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.6) 18%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Property name + icon (icon matches title cap height, property colour — no badge box) */}
        <div className="absolute bottom-2 left-2.5 right-2 z-10 min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-white font-semibold text-[30px] leading-tight drop-shadow-sm">
              {displayName}
            </p>
            <IconComponent
              className="h-[28px] w-[28px] shrink-0 drop-shadow-sm stroke-[1.75]"
              style={{ color: iconColor }}
              aria-hidden
            />
          </div>
          {identitySubtitle && (
            <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-white/90 drop-shadow-sm">
              {identitySubtitle}
            </p>
          )}
        </div>

        {/* Today + weather — bottom right (moved from dashboard gradient header) */}
        {propertyCardWeather !== undefined && (
          <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end gap-0.5 text-right pointer-events-none">
            <span className="text-[13px] font-semibold text-white leading-tight drop-shadow-sm">
              Today
            </span>
            <div className="flex items-center justify-end gap-1.5 text-white/90">
              <WeatherIcon className="h-4 w-4 shrink-0 drop-shadow-sm" aria-hidden />
              <span className="text-xs font-medium whitespace-nowrap drop-shadow-sm">
                {propertyCardWeather ? `${propertyCardWeather.temp}°C` : "--°C"}
              </span>
            </div>
          </div>
        )}

        {/* Edit photo — top right; visible on thumbnail hover or keyboard focus */}
        <button
          type="button"
          onClick={handlePhotoEditClick}
          disabled={isUploadingPhoto}
          className={cn(
            "absolute top-2 right-2 z-20",
            "flex items-center justify-center rounded-full",
            "bg-black/30 hover:bg-black/50 backdrop-blur-sm",
            "opacity-0 transition-opacity duration-200",
            "group-hover:opacity-100 focus-visible:opacity-100",
            isUploadingPhoto && "opacity-50 cursor-not-allowed group-hover:opacity-50"
          )}
          style={{ width: "26px", height: "26px" }}
          aria-label="Change property photo"
        >
          <Camera className="h-3.5 w-3.5 text-white" />
        </button>

        {/* Inset shadow — matches ThumbnailBlock */}
        <div
          className="absolute left-0 right-0 top-0 h-[146px] pointer-events-none"
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

      {/* ── PERFORATION LINE (PropertyCard DNA; lock to 1px — no flex growth) ─ */}
      <div
        className="shrink-0 w-full overflow-hidden"
        style={{
          height: "1px",
          minHeight: "1px",
          maxHeight: "1px",
          backgroundImage:
            "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
          backgroundSize: "7px 1px",
          backgroundRepeat: "repeat-x",
          boxShadow: "1px 1px 0px rgba(255,255,255,1), -1px -1px 1px rgba(0,0,0,0.075)",
        }}
      />

      {/* ── TAB STRIP ────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-0 w-full min-w-0 shrink-0 bg-muted/20">
        <div
          ref={tabScrollRef}
          className="flex w-full min-w-0 flex-nowrap items-start justify-start gap-0 overflow-x-auto overflow-y-hidden px-3 pb-[6px] pt-[10px] sm:px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(idx as TabIndex)}
              className={cn(
                "flex h-6 shrink-0 items-center justify-center rounded-[8px] px-2 font-mono text-[10px] font-medium uppercase leading-none tracking-wide",
                "transition-[color,background-color,box-shadow] duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0",
                activeTab === idx
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-background/55 hover:text-foreground/90"
              )}
              style={
                activeTab === idx
                  ? {
                      backgroundColor: "rgba(255, 255, 255, 1)",
                      boxShadow:
                        "-1px -1px 2px 0px rgba(0, 0, 0, 0.07), 0 1px 1px 0px rgba(255, 255, 255, 0.55)",
                    }
                  : undefined
              }
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          aria-hidden={!showTabStripRightFade}
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-16 min-w-[56px] items-center justify-end pr-1 transition-opacity duration-200",
            showTabStripRightFade ? "opacity-100" : "opacity-0"
          )}
          style={TAB_STRIP_RIGHT_FADE_STYLE}
        >
          <button
            type="button"
            tabIndex={showTabStripRightFade ? 0 : -1}
            aria-label="Scroll to more tabs"
            onClick={scrollTabsRight}
            className={cn(
              "pointer-events-auto flex h-6 w-4 shrink-0 items-center justify-center rounded-full pt-px",
              "text-[#687B7D] shadow-sm transition-opacity",
              "hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              showTabStripRightFade ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-[#687B7D]",
                "drop-shadow-[0_0_6px_rgba(104,123,125,0.85)]",
                "animate-[chip-chevron-glow_2.4s_ease-in-out_infinite]"
              )}
              strokeWidth={2.25}
            />
          </button>
        </div>
      </div>

      {/* ── SLIDING CARD CONTENT + collapse affordance (all tabs) ───────── */}
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        onMouseEnter={() => {
          if (!isBelowTabsCollapsed) setIsBelowTabsHovered(true);
        }}
        onMouseLeave={() => setIsBelowTabsHovered(false)}
      >
        <div
          id="property-identity-below-tabs-panel"
          className={cn(
            "min-h-0 min-w-0 w-full overflow-hidden transition-[max-height] duration-300 ease-out",
            isBelowTabsCollapsed ? "max-h-0" : "max-h-[251px] flex-1"
          )}
        >
          <div
            className={cn(
              "relative z-0 h-full min-h-0 max-h-[251px] flex-1 overflow-visible transition-[opacity,transform,box-shadow] duration-300 ease-out",
              isBelowTabsCollapsed && "pointer-events-none opacity-0 -translate-y-3",
              !isBelowTabsCollapsed &&
                isBelowTabsHovered &&
                "shadow-sm ring-1 ring-primary/15 ring-offset-0"
            )}
          >
            <div
              className="flex h-full min-h-0 pointer-events-none transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${activeTab * 100}%)` }}
            >

          {/* 0 ── PROPERTY dashboard (3×2 grid) ─────────────────────────── */}
          <div
            className={cn(
              "w-full min-w-0 flex-shrink-0 h-full min-h-0 overflow-hidden",
              activeTab === 0 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            <PropertySummaryDashboardGrid
              openTasksCount={taskCount}
              urgentOpenTaskCount={urgentCount}
              completionPct={taskDashboardMetrics.completionPct}
              completedLabel={taskDashboardMetrics.completedLabel}
              onOpenTasks={() =>
                onOpenTasksClick ? onOpenTasksClick() : navigate(`/properties/${property.id}/tasks`)
              }
              onOpenUrgentTasks={() =>
                onFilterClick
                  ? onFilterClick("show-tasks-urgent")
                  : navigate(
                      propertyHubPath(property.id, {
                        [WORKBENCH_ISSUES_FILTER_QUERY]: "open",
                        [WORKBENCH_TASK_PRIORITY_QUERY]: "urgent",
                      })
                    )
              }
              onAddTask={onAddTaskClick}
              spacesCount={spacesCount}
              spaceUrgentIssuesCount={taskDashboardMetrics.spacesWithUrgentIssueCount}
              onOpenSpaces={() => navigate(propertySubPath(property.id, "spaces-organise"))}
              onOpenUrgentSpaces={() =>
                onFilterClick
                  ? onFilterClick("show-spaces-urgent")
                  : navigate(
                      `/properties/${property.id}/spaces/organise?workTab=issues&urgent=1`
                    )
              }
              assetsCount={assetsCount}
              assetsUrgentIssuesCount={assetsAttentionCount}
              onOpenAssets={() =>
                navigate(`/assets?property=${encodeURIComponent(property.id)}`)
              }
              onOpenAttentionAssets={() =>
                onFilterClick
                  ? onFilterClick("show-assets-attention")
                  : navigate(`/assets?property=${encodeURIComponent(property.id)}&attention=1`)
              }
              documentsCountLabel={documentsCountLabel}
              docDueSoon={documentDashboardBuckets.dueSoon}
              docExpiring={documentDashboardBuckets.expiring}
              docMissing={documentDashboardBuckets.missing}
              onOpenDocuments={() => navigate(propertySubPath(property.id, "documents"))}
            />
          </div>

          {/* 1 ── DETAILS ──────────────────────────────────────────────── */}
          <div
            className={cn(
              "w-full flex-shrink-0 h-full min-h-0 flex flex-col px-3 py-2.5",
              activeTab === 1 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
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
            {!isEditingDetails && (
              <div className="shrink-0 pt-2.5 mt-1 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setShowArchivePropertyDialog(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-md py-2 px-2 text-[11px] font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/40 hover:text-[#EB6834] hover:shadow-md"
                >
                  <Archive className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  Archive property
                </button>
              </div>
            )}
          </div>

          {/* 2 ── CONTACTS ─────────────────────────────────────────────── */}
          <div
            className={cn(
              "w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto",
              activeTab === 2 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
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
          <div
            className={cn(
              "w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto",
              activeTab === 3 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
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
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePhotoEditClick}
                    disabled={isUploadingPhoto}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors border border-primary/20 shadow-sm disabled:opacity-50"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {isUploadingPhoto
                      ? "Uploading…"
                      : property.thumbnail_url
                        ? "Replace thumbnail"
                        : "Add thumbnail"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/properties/${property.id}/photos`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors shadow-sm"
                  >
                    View all →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/properties/${property.id}/photos`)}
                  className="flex w-full items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium text-foreground bg-background/80 hover:bg-muted/40 transition-colors shadow-sm"
                >
                  <Upload className="h-3.5 w-3.5 text-primary" />
                  Upload other images
                </button>
              </div>
            </div>
          </div>

          {/* 4 ── TIMELINE ───────────────────────────────────────────────── */}
          <div
            className={cn(
              "w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto",
              activeTab === 4 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            {timelineLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : timelineEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {timelineEvents.slice(0, 15).map((ev) => (
                  <li key={ev.id} className="flex gap-2 text-xs leading-tight">
                    <span className="shrink-0 text-muted-foreground/60 font-mono">
                      {new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-foreground/80 line-clamp-2">{ev.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* 5 ── VENDORS ────────────────────────────────────────────────── */}
          <div
            className={cn(
              "w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto",
              activeTab === 5 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            {vendorsLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : vendorActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No assignees yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {vendorActivity.map((v, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground/80 truncate max-w-[60%]">{v.vendorName}</span>
                    <span className="text-muted-foreground shrink-0">
                      {v.tasksCompleted} done
                      {v.lastVisit ? ` · ${new Date(v.lastVisit).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 6 ── DRIFT ──────────────────────────────────────────────────── */}
          <div
            className={cn(
              "w-full flex-shrink-0 h-full px-3 py-2.5 overflow-y-auto",
              activeTab === 6 ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            {driftLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : !drift.hasDrift ? (
              <p className="text-xs text-muted-foreground">No compliance drift detected.</p>
            ) : (
              <ul className="space-y-1.5">
                {drift.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        "shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full",
                        item.severity === "high" && "bg-destructive",
                        item.severity === "medium" && "bg-amber-500",
                        item.severity === "low" && "bg-muted-foreground"
                      )}
                    />
                    <span className="text-foreground/80 line-clamp-2">{item.ruleTitle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

            </div>
          </div>
        </div>

        {!isBelowTabsCollapsed && (
          <div
            className={cn(
              "flex w-full shrink-0 items-center justify-center overflow-hidden transition-[height] duration-300 ease-out",
              showCollapseStrip ? "h-[30px]" : "h-0"
            )}
          >
            <button
              type="button"
              className={cn(
                "flex h-7 w-full max-w-[120px] items-center justify-center rounded-[10px] bg-white text-muted-foreground transition-all duration-200",
                "shadow-sm hover:bg-background/70 hover:text-foreground hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EC9CE]/40 focus-visible:ring-offset-0"
              )}
              aria-expanded={!isBelowTabsCollapsed}
              aria-controls="property-identity-below-tabs-panel"
              aria-label="Collapse section below tabs"
              onClick={() => {
                setIsBelowTabsCollapsed(true);
                setIsBelowTabsHovered(false);
              }}
            >
              <ChevronsUp className="h-4 w-4 opacity-80" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        )}

        {isBelowTabsCollapsed && (
          <div className="flex min-h-[36px] shrink-0 items-center justify-center px-2 py-1">
            <button
              type="button"
              className={cn(
                "flex h-8 w-full max-w-[97px] items-center justify-center gap-1.5 rounded-[10px] text-xs font-medium text-muted-foreground transition-all duration-200",
                "shadow-sm hover:bg-background/70 hover:text-foreground hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EC9CE]/40 focus-visible:ring-offset-0"
              )}
              aria-expanded={false}
              aria-controls="property-identity-below-tabs-panel"
              aria-label="Expand section below tabs"
              onClick={() => setIsBelowTabsCollapsed(false)}
            >
              <ChevronsDown className="h-4 w-4 opacity-80" strokeWidth={2.25} aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-wide">Show panel</span>
            </button>
          </div>
        )}
      </div>

      <AlertDialog open={showArchivePropertyDialog} onOpenChange={setShowArchivePropertyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this property?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                <span className="font-medium text-foreground">{displayName}</span> will be removed from your
                active property list. Existing tasks and linked data are kept.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchivingProperty}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isArchivingProperty}
              className="bg-[#EB6834] text-white hover:bg-[#EB6834]/90 shadow-sm"
              onClick={() => void handleConfirmArchiveProperty()}
            >
              {isArchivingProperty ? "Archiving…" : "Archive property"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
