import { useMemo, useState, type ReactNode } from "react";
import { Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { useNavigate } from "react-router-dom";
import {
  propertyHubIssuesPath,
  propertyHubRecordsPath,
  propertyHubSpacesPath,
  propertyHubAssetsPath,
  propertyHubPeoplePath,
  propertyHubPath,
  WORKBENCH_ISSUES_FILTER_QUERY,
  WORKBENCH_TASK_PRIORITY_QUERY,
} from "@/lib/propertyRoutes";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { PropertySummaryPanel } from "@/components/properties/PropertySummaryPanel";
import {
  PropertyHubNavCards,
  countPropertyPeople,
  type PropertyHubNavCardId,
} from "@/components/properties/PropertyHubNavCards";
import { PropertyEditSheet } from "@/components/properties/PropertyEditSheet";
import { propertiesService } from "@/services/properties/properties";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  latitude?: number | null;
  longitude?: number | null;
  open_tasks_count?: number | null;
  assets_count?: number | null;
  spaces_count?: number | null;
  expired_compliance_count?: number | null;
  valid_compliance_count?: number | null;
};

interface PropertyIdentityStripProps {
  property: PropertyForStrip;
  onAddTaskClick?: () => void;
  urgentOpenTaskCount?: number;
  onPropertyArchived?: () => void;
  onOpenTasksClick?: () => void;
  onFilterClick?: (filterId: string) => void;
  externalDashboard?: boolean;
  /** Rendered between the summary panel and hub nav cards (e.g. mini calendar). */
  betweenSummaryAndNav?: ReactNode;
}

/**
 * Single-property identity card for the left workbench rail:
 * photo header, summary dashboard, and hub navigation cards.
 */
export function PropertyIdentityStrip({
  property,
  urgentOpenTaskCount = 0,
  onPropertyArchived,
  onOpenTasksClick,
  onFilterClick,
  externalDashboard = false,
  betweenSummaryAndNav,
}: PropertyIdentityStripProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { documents: propertyDocuments = [] } = usePropertyDocuments(property.id, undefined, {
    limit: 500,
  });
  const { data: propertyTasksView = [] } = useTasksQuery(property.id);
  const { members } = useOrgMembers();

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showArchivePropertyDialog, setShowArchivePropertyDialog] = useState(false);
  const [isArchivingProperty, setIsArchivingProperty] = useState(false);

  const displayName = property.nickname || property.address;
  const iconColor = property.icon_color_hex || "#8EC9CE";
  const IconComponent = getPropertyChipIcon(property.icon_name);

  const peopleCount = useMemo(
    () => countPropertyPeople(property.id, property.owner_name, property.contact_name, members),
    [property.id, property.owner_name, property.contact_name, members]
  );

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

  const openHubNav = (id: PropertyHubNavCardId) => {
    switch (id) {
      case "spaces":
        navigate(propertyHubSpacesPath(property.id));
        return;
      case "assets":
        navigate(propertyHubAssetsPath(property.id));
        return;
      case "people":
        navigate(propertyHubPeoplePath(property.id));
        return;
      case "records":
        navigate(propertyHubRecordsPath(property.id));
        return;
    }
  };

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="overflow-hidden rounded-[12px] border border-border/20 bg-card/60 shadow-[1px_1px_2px_0px_rgba(0,0,0,0.05),inset_1px_1px_1px_0px_rgba(255,255,255,0.65)]">
        <div
          className="group relative w-full shrink-0 overflow-hidden"
          style={{
            height: "180px",
            backgroundColor: property.thumbnail_url ? undefined : iconColor,
          }}
        >
          {property.thumbnail_url ? (
            <img
              src={property.thumbnail_url}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : null}

          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-[180px]"
            style={{
              background:
                "linear-gradient(0deg, rgba(0, 0, 0, 0.65) 22%, rgba(0, 0, 0, 0) 48%, rgba(0, 0, 0, 0) 100%)",
            }}
          />

          <div className="absolute bottom-2 left-2.5 right-10 z-10 min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <IconComponent
                className="h-[30px] w-[30px] shrink-0 drop-shadow-sm stroke-[1.75]"
                style={{ color: iconColor }}
                aria-hidden
              />
              <p className="min-w-0 truncate text-[30px] font-semibold leading-tight text-white drop-shadow-sm">
                {displayName}
              </p>
            </div>
            {property.address ? (
              <p className="mt-0.5 pt-[3px] text-[12px] font-medium leading-snug text-white/90 drop-shadow-sm">
                {property.address}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setShowEditSheet(true)}
            className={cn(
              "absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full",
              "bg-black/30 text-white backdrop-blur-sm transition-opacity duration-200",
              "opacity-0 hover:bg-black/50 group-hover:opacity-100 focus-visible:opacity-100"
            )}
            aria-label="Edit property"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>

          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-[180px]"
            style={{
              boxShadow:
                "inset 2px 2px 2px 0px rgba(255,255,255,0.4), inset -1px -1px 2px 0px rgba(0,0,0,0.1)",
            }}
          />
        </div>

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

        <div className="px-[10px] py-0">
          <PropertySummaryPanel
            property={property}
            tasks={propertyTasksView}
            documents={propertyDocuments}
            peopleCount={peopleCount}
            urgentOpenTaskCount={urgentOpenTaskCount}
            onOpenUrgent={() =>
              onFilterClick
                ? onFilterClick("show-tasks-urgent")
                : navigate(
                    propertyHubPath(property.id, {
                      [WORKBENCH_ISSUES_FILTER_QUERY]: "open",
                      [WORKBENCH_TASK_PRIORITY_QUERY]: "urgent",
                    })
                  )
            }
            onOpenTasks={() =>
              onOpenTasksClick
                ? onOpenTasksClick()
                : navigate(propertyHubIssuesPath(property.id, { issuesFilter: "open" }))
            }
            onOpenCompliance={() => navigate(propertyHubRecordsPath(property.id, "compliance"))}
            onOpenInspections={() => navigate(propertyHubRecordsPath(property.id, "expiring"))}
            onOpenSpaces={() => openHubNav("spaces")}
            onOpenAssets={() => openHubNav("assets")}
            onOpenPeople={() => openHubNav("people")}
            onOpenRecords={() => openHubNav("records")}
          />
        </div>
      </div>

      {betweenSummaryAndNav}

      <PropertyHubNavCards
        propertyId={property.id}
        ownerName={property.owner_name}
        contactName={property.contact_name}
        onOpen={openHubNav}
        onAdd={(id) => {
          if (id === "people") {
            setShowEditSheet(true);
            return;
          }
          openHubNav(id);
        }}
      />

      <PropertyEditSheet
        property={property}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onArchive={() => setShowArchivePropertyDialog(true)}
      />

      <AlertDialog open={showArchivePropertyDialog} onOpenChange={setShowArchivePropertyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this property?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                <span className="font-medium text-foreground">{displayName}</span> will be removed from
                your active property list. Existing tasks and linked data are kept.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchivingProperty}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isArchivingProperty}
              className="bg-[#EB6834] text-white shadow-sm hover:bg-[#EB6834]/90"
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
