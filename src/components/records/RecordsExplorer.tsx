import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, Clock, FileQuestion, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { OnboardingArea } from "@/components/onboarding/onboardingPropertyAreas";
import type { SpaceLike } from "@/lib/spaces/partitionPropertySpaces";
import {
  type OnboardingDragData,
  onboardingDragLabel,
  parseSpaceDroppableId,
  propertyLevelDroppableId,
} from "@/components/onboarding/onboardingAreasDnd";
import {
  documentDisplayTitle,
  filingDropOverlayLabel,
  isPropertyLevelDocument,
} from "@/lib/records/attachmentSpaces";
import {
  EXPLORER_CATEGORY_ORDER,
  describeEmptyExplorerState,
  explorerCategoryLabel,
  locationFilterLabel,
  type ExplorerAttentionFilter,
  type ExplorerCategoryId,
  type ExplorerLocationFilter,
  attentionCountForCategory,
  countByExplorerCategory,
  documentExpiryState,
  documentHasMissingInfo,
  filterExplorerDocuments,
} from "@/lib/records/explorerFilters";
import { CollectionShelf } from "@/components/organise/CollectionShelf";
import {
  OrganiseViewTabs,
  type OrganiseViewTab,
} from "@/components/organise/OrganiseViewTabs";
import { OrganiseControlsBar } from "@/components/organise/OrganiseControlsBar";
import {
  AttentionListView,
  type AttentionSection,
} from "@/components/organise/AttentionListView";
import type { FilterGroup, FilterOption } from "@/components/ui/filters/FilterBar";
import type { WorkbenchSortBy } from "@/contexts/WorkbenchControlsContext";
import { PlacesDrawer } from "@/components/organise/PlacesDrawer";
import { PlacesTree } from "@/components/organise/PlacesTree";
import { RecordsExplorerCategoryCard } from "@/components/records/RecordsExplorerCategoryCard";
import { RecordsExplorerDocumentRow } from "@/components/records/RecordsExplorerDocumentRow";
import { RecordsExplorerBulkBar } from "@/components/records/RecordsExplorerBulkBar";
import { RecordsObligationAttentionRow } from "@/components/records/RecordsObligationAttentionRow";
import { FileToSpacesDialog } from "@/components/records/FileToSpacesDialog";
import { ChangeCategoryDialog } from "@/components/records/ChangeCategoryDialog";
import { RecordsCompliancePanel } from "@/components/records/RecordsCompliancePanel";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";

export type RecordsOrganiseView = "attention" | "types" | "compliance";

const VIEW_TABS: readonly OrganiseViewTab<RecordsOrganiseView>[] = [
  {
    id: "attention",
    label: "Attention",
    subtitle:
      "Documents and obligations that need action — urgent, expiring soon, or missing info.",
  },
  {
    id: "types",
    label: "Types",
    subtitle: "Records by category. Drag a row onto a location to file it — filing links, it never moves.",
  },
  {
    id: "compliance",
    label: "Compliance",
    subtitle: "Recurring rules and automation for this property.",
  },
] as const;

const ATTENTION_FILTER_PREFIX = "filter-record-";
const CATEGORY_FILTER_PREFIX = "filter-record-cat-";

const ATTENTION_FILTER_OPTIONS: { id: ExplorerAttentionFilter; label: string }[] = [
  { id: "needs-attention", label: "Attention" },
  { id: "expiring", label: "Expiring" },
  { id: "missing-info", label: "Missing info" },
];

type RecordsExplorerProps = {
  documents: PropertyDocument[];
  spaces: SpaceLike[];
  areas: OnboardingArea[];
  roomsByAreaId: Record<string, SpaceLike[]>;
  unassignedRooms: SpaceLike[];
  filingEnabled: boolean;
  docsLoading?: boolean;
  onOpenDocument: (id: string) => void;
  onAddRecord: () => void;
  onFileToSpace: (doc: PropertyDocument, spaceId: string) => Promise<void>;
  onRemoveSpaceLink: (
    doc: PropertyDocument,
    spaceId: string,
    spaceName: string
  ) => Promise<void>;
  onSetSpaceLinks: (
    doc: PropertyDocument,
    spaceIds: string[]
  ) => Promise<void>;
  onAddSpaceLinksBulk: (
    docs: PropertyDocument[],
    spaceIds: string[]
  ) => Promise<void>;
  onChangeCategory: (
    docs: PropertyDocument[],
    category: string | null
  ) => Promise<void>;
  onDeleteDocument: (doc: PropertyDocument) => Promise<void>;
  /** Compliance obligations needing action — shown in Attention only (non-draggable). */
  attentionObligations?: ComplianceRecord[];
  onOpenObligation?: (id: string) => void;
  /** Property for Compliance tab rules (required when view can be compliance). */
  propertyId?: string | null;
  /** Bump to open the create-rule modal on the Compliance tab. */
  complianceCreateNonce?: number;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  view?: RecordsOrganiseView;
  onViewChange?: (view: RecordsOrganiseView) => void;
  className?: string;
};

export function RecordsExplorer({
  documents,
  spaces,
  areas,
  roomsByAreaId,
  unassignedRooms,
  filingEnabled,
  docsLoading,
  onOpenDocument,
  onAddRecord,
  onFileToSpace,
  onRemoveSpaceLink,
  onSetSpaceLinks,
  onAddSpaceLinksBulk,
  onChangeCategory,
  onDeleteDocument,
  attentionObligations = [],
  onOpenObligation,
  propertyId = null,
  complianceCreateNonce = 0,
  searchQuery: searchProp,
  onSearchQueryChange,
  view: viewProp,
  onViewChange,
  className,
}: RecordsExplorerProps) {
  const [internalView, setInternalView] = useState<RecordsOrganiseView>("attention");
  const view = viewProp ?? internalView;
  const setView = useCallback(
    (next: RecordsOrganiseView) => {
      setInternalView(next);
      onViewChange?.(next);
    },
    [onViewChange]
  );

  const [sortBy, setSortBy] = useState<WorkbenchSortBy>("title");
  const [category, setCategory] = useState<ExplorerCategoryId>("all");
  const [locationFilter, setLocationFilter] = useState<ExplorerLocationFilter>({
    kind: "all",
  });
  const [attention, setAttention] = useState<ExplorerAttentionFilter>("all");
  const [internalSearch, setInternalSearch] = useState("");
  const search = searchProp ?? internalSearch;
  const setSearch = onSearchQueryChange ?? setInternalSearch;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false);
  const [locationDrawerMode, setLocationDrawerMode] = useState<"browse" | "filing">(
    "browse"
  );

  const [activeDrag, setActiveDrag] = useState<OnboardingDragData | null>(null);
  const [dragOverLabel, setDragOverLabel] = useState<string | null>(null);

  const [fileToDocs, setFileToDocs] = useState<PropertyDocument[]>([]);
  const [fileToMode, setFileToMode] = useState<"reconcile" | "add">("reconcile");
  const [categoryDocs, setCategoryDocs] = useState<PropertyDocument[]>([]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const spaceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of spaces) {
      map[s.id] = (s.name ?? "").trim() || "Space";
    }
    return map;
  }, [spaces]);

  const areaNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of areas) map[a.id] = a.name;
    return map;
  }, [areas]);

  const docCountBySpaceId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      for (const link of doc.linked_spaces ?? []) {
        counts[link.id] = (counts[link.id] ?? 0) + 1;
      }
    }
    return counts;
  }, [documents]);

  const propertyLevelCount = useMemo(
    () => documents.filter((d) => isPropertyLevelDocument(d)).length,
    [documents]
  );

  const categoryCounts = useMemo(() => {
    const map: Record<string, { total: number; attention: number }> = {};
    for (const id of EXPLORER_CATEGORY_ORDER) {
      map[id] = {
        total: countByExplorerCategory(documents, id),
        attention: attentionCountForCategory(documents, id),
      };
    }
    return map;
  }, [documents]);

  const sortDocs = useCallback(
    (list: PropertyDocument[]): PropertyDocument[] => {
      const sorted = [...list];
      if (sortBy === "recent") {
        sorted.sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        );
      } else if (sortBy === "priority") {
        const rank = (d: PropertyDocument) => {
          const state = documentExpiryState(d);
          if (state === "overdue") return 0;
          if (state === "expiring") return 1;
          if (documentHasMissingInfo(d)) return 2;
          return 3;
        };
        sorted.sort((a, b) => rank(a) - rank(b));
      } else {
        sorted.sort((a, b) =>
          documentDisplayTitle(a).localeCompare(documentDisplayTitle(b))
        );
      }
      return sorted;
    },
    [sortBy]
  );

  const visibleDocs = useMemo(
    () =>
      sortDocs(
        filterExplorerDocuments(documents, {
          category,
          location: locationFilter,
          attention,
          search,
        })
      ),
    [documents, category, locationFilter, attention, search, sortDocs]
  );

  /* ---------------- standard [FILTER] [SORT] [SEARCH] controls ---------------- */

  const filterPrimaryOptions: FilterOption[] = useMemo(
    () => [
      {
        id: `${ATTENTION_FILTER_PREFIX}needs-attention`,
        label: "Attention",
        icon: <AlertTriangle className="h-4 w-4" />,
        color: "#EB6834",
      },
      {
        id: `${ATTENTION_FILTER_PREFIX}expiring`,
        label: "Expiring",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        id: `${ATTENTION_FILTER_PREFIX}missing-info`,
        label: "Missing info",
        icon: <FileQuestion className="h-4 w-4" />,
      },
    ],
    []
  );

  const filterSecondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "record-category",
        label: "Type",
        options: EXPLORER_CATEGORY_ORDER.filter((id) => id !== "all").map((id) => ({
          id: `${CATEGORY_FILTER_PREFIX}${id}`,
          label: explorerCategoryLabel(id),
        })),
      },
    ],
    []
  );

  const selectedControlFilters = useMemo(() => {
    const set = new Set<string>();
    if (attention !== "all") set.add(`${ATTENTION_FILTER_PREFIX}${attention}`);
    if (category !== "all") set.add(`${CATEGORY_FILTER_PREFIX}${category}`);
    return set;
  }, [attention, category]);

  const handleControlFilterChange = useCallback(
    (filterId: string, selected: boolean) => {
      if (filterId.startsWith(CATEGORY_FILTER_PREFIX)) {
        const id = filterId.slice(CATEGORY_FILTER_PREFIX.length) as ExplorerCategoryId;
        setCategory(selected ? id : "all");
        return;
      }
      if (filterId.startsWith(ATTENTION_FILTER_PREFIX)) {
        const id = filterId.slice(
          ATTENTION_FILTER_PREFIX.length
        ) as ExplorerAttentionFilter;
        const known = ATTENTION_FILTER_OPTIONS.some((o) => o.id === id);
        if (known) setAttention(selected ? id : "all");
      }
    },
    []
  );

  const selectedDocs = useMemo(
    () => visibleDocs.filter((d) => selectedIds.has(d.id)),
    [visibleDocs, selectedIds]
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(visibleDocs.map((d) => d.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleDocs]);

  const categoryTitle = explorerCategoryLabel(category);
  const activeLocationLabel = locationFilterLabel(locationFilter, {
    spaceNameById,
    areaNameById,
  });

  const openLocationDrawer = useCallback((mode: "browse" | "filing") => {
    setLocationDrawerMode(mode);
    setLocationDrawerOpen(true);
  }, []);

  const toggleSelected = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = (event.active.data.current as OnboardingDragData) ?? null;
      setActiveDrag(data);
      setDragOverLabel(null);
      if (data?.kind === "record" && filingEnabled) {
        openLocationDrawer("filing");
      }
    },
    [filingEnabled, openLocationDrawer]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over ? String(event.over.id) : null;
      if (!overId || !activeDrag || activeDrag.kind !== "record") {
        setDragOverLabel(null);
        return;
      }
      if (overId === propertyLevelDroppableId()) {
        setDragOverLabel(filingDropOverlayLabel(null, true));
        return;
      }
      const spaceId = parseSpaceDroppableId(overId);
      if (spaceId) {
        setDragOverLabel(
          filingDropOverlayLabel(spaceNameById[spaceId] ?? null, false)
        );
        return;
      }
      setDragOverLabel(null);
    },
    [activeDrag, spaceNameById]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const drag = activeDrag;
      setActiveDrag(null);
      setDragOverLabel(null);
      if (locationDrawerMode === "filing") {
        // Keep drawer open briefly so user can file more; switch to browse labels
        setLocationDrawerMode("browse");
      }
      if (!event.over || !drag || drag.kind !== "record" || !filingEnabled) return;
      const overId = String(event.over.id);
      if (overId === propertyLevelDroppableId()) return;
      const spaceId = parseSpaceDroppableId(overId);
      if (!spaceId) return;
      const doc = documents.find((d) => d.id === drag.recordId);
      if (!doc) return;
      await onFileToSpace(doc, spaceId);
    },
    [activeDrag, filingEnabled, documents, onFileToSpace, locationDrawerMode]
  );

  const handleSelectLocation = useCallback(
    (next: ExplorerLocationFilter) => {
      setLocationFilter(next);
      if (locationDrawerMode === "browse") {
        // Keep drawer open so users can refine; chips show after close too
      }
    },
    [locationDrawerMode]
  );

  const emptyMessage = describeEmptyExplorerState({
    category,
    location: locationFilter,
    locationLabel: activeLocationLabel,
  });

  const renderDocRow = (doc: PropertyDocument, opts?: { showDragHandle?: boolean }) => (
    <RecordsExplorerDocumentRow
      document={doc}
      selected={selectedIds.has(doc.id)}
      onSelectedChange={(next) => toggleSelected(doc.id, next)}
      filingEnabled={filingEnabled}
      showDragHandle={opts?.showDragHandle ?? false}
      onOpen={() => onOpenDocument(doc.id)}
      onEdit={() => onOpenDocument(doc.id)}
      onFileTo={() => {
        setFileToMode("reconcile");
        setFileToDocs([doc]);
      }}
      onDownload={() => {
        if (doc.file_url) window.open(doc.file_url, "_blank");
      }}
      onDelete={() => void onDeleteDocument(doc)}
      onRemoveSpaceLink={(spaceId, spaceName) =>
        void onRemoveSpaceLink(doc, spaceId, spaceName)
      }
    />
  );

  /* ------------------- Attention view — Urgent / Expiring / Needs info ------------------- */

  const attentionBase = useMemo(
    () =>
      sortDocs(
        filterExplorerDocuments(documents, {
          category,
          location: locationFilter,
          attention: "all",
          search,
        })
      ),
    [documents, category, locationFilter, search, sortDocs]
  );

  const filteredObligations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attentionObligations;
    return attentionObligations.filter((r) => {
      const hay = `${r.title} ${r.complianceType} ${r.propertyName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [attentionObligations, search]);

  const attentionSections: AttentionSection[] = (() => {
    const urgentDocs = attentionBase.filter((d) => documentExpiryState(d) === "overdue");
    const expiringDocs = attentionBase.filter((d) => documentExpiryState(d) === "expiring");
    const missingDocs = attentionBase.filter(
      (d) => documentHasMissingInfo(d) && documentExpiryState(d) === "none"
    );
    const urgentObligations = filteredObligations.filter((r) => r.status === "overdue");
    const expiringObligations = filteredObligations.filter((r) => r.status === "expiring");
    const missingObligations = filteredObligations.filter((r) => r.status === "missing");

    const toContent = (
      docs: PropertyDocument[],
      obligations: ComplianceRecord[]
    ) => (
      <ul className="space-y-2">
        {obligations.map((record) => (
          <li key={`obligation-${record.id}`}>
            <RecordsObligationAttentionRow
              record={record}
              onOpen={onOpenObligation ? () => onOpenObligation(record.id) : undefined}
            />
          </li>
        ))}
        {docs.map((doc) => (
          <li key={doc.id}>{renderDocRow(doc, { showDragHandle: false })}</li>
        ))}
      </ul>
    );

    const sections: AttentionSection[] = [];
    const urgentCount = urgentDocs.length + urgentObligations.length;
    if (urgentCount > 0) {
      sections.push({
        id: "urgent",
        title: "Urgent",
        subtitle: `${urgentCount} overdue`,
        icon: <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />,
        accentColor: "#EB6834",
        content: toContent(urgentDocs, urgentObligations),
      });
    }
    const expiringCount = expiringDocs.length + expiringObligations.length;
    if (expiringCount > 0) {
      sections.push({
        id: "expiring",
        title: "Expiring soon",
        subtitle: `${expiringCount} within 30 days`,
        icon: <Clock className="h-5 w-5" aria-hidden />,
        accentColor: "#C4A35A",
        content: toContent(expiringDocs, expiringObligations),
      });
    }
    const missingCount = missingDocs.length + missingObligations.length;
    if (missingCount > 0) {
      sections.push({
        id: "missing",
        title: "Needs info",
        subtitle: `${missingCount} incomplete`,
        icon: <FileQuestion className="h-5 w-5" aria-hidden />,
        content: toContent(missingDocs, missingObligations),
      });
    }
    return sections;
  })();

  const locationPanel = (
    <PlacesTree
      areas={areas}
      roomsByAreaId={roomsByAreaId}
      unassignedRooms={unassignedRooms}
      countBySpaceId={docCountBySpaceId}
      propertyLevel={{
        label: "Property level",
        count: propertyLevelCount,
        droppable: true,
      }}
      selected={locationFilter}
      onSelect={handleSelectLocation}
      enabled={filingEnabled}
      disabledMessage="Select one property to organise records by space."
      mode={locationDrawerMode}
      dropTargets="spaces"
      showRooms
      browseLabel="Browse by location"
      filingLabel="File to location"
      emptyHint="Add areas and rooms on Spaces to file documents by location."
      className="h-full"
    />
  );

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => {
        setActiveDrag(null);
        setDragOverLabel(null);
        setLocationDrawerMode("browse");
      }}
    >
      <div
        className={cn(
          "flex h-full min-h-[420px] min-w-0 flex-1 flex-col gap-4",
          className
        )}
      >
        <OrganiseViewTabs
          tabs={VIEW_TABS}
          active={view}
          onChange={setView}
          ariaLabel="Records views"
        />

        {view !== "compliance" ? (
          <OrganiseControlsBar
            primaryOptions={filterPrimaryOptions}
            secondaryGroups={filterSecondaryGroups}
            selectedFilters={selectedControlFilters}
            onFilterChange={handleControlFilterChange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search documents"
          />
        ) : null}

        {view === "attention" ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AttentionListView
              sections={attentionSections}
              emptyState={
                <span>
                  Nothing needs attention — no overdue, expiring, or incomplete records
                  or obligations
                  {search.trim() ? " match your search" : ""}.
                </span>
              }
            />
          </section>
        ) : view === "compliance" ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {propertyId ? (
              <RecordsCompliancePanel
                propertyId={propertyId}
                openCreateNonce={complianceCreateNonce}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Select a property to manage compliance rules.
              </p>
            )}
          </section>
        ) : (
          <>
        {/* Shelf — compact category carousel */}
        <CollectionShelf prevLabel="Previous categories" nextLabel="Next categories">
          {EXPLORER_CATEGORY_ORDER.map((id) => (
            <RecordsExplorerCategoryCard
              key={id}
              categoryId={id}
              count={categoryCounts[id]?.total ?? 0}
              attentionCount={categoryCounts[id]?.attention ?? 0}
              selected={category === id}
              onSelect={() => setCategory(id)}
            />
          ))}
        </CollectionShelf>

        {/* Full-width document workspace */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="mb-3 space-y-2.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {categoryTitle}
                </h2>
                <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  {visibleDocs.length} document{visibleDocs.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  onClick={() => openLocationDrawer("browse")}
                  disabled={!filingEnabled}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Locations
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={onAddRecord}
                  disabled={!filingEnabled}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add record
                </Button>
              </div>
            </div>

            {activeLocationLabel ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  Location:
                </span>
                <FilterChip
                  label={activeLocationLabel}
                  onClear={() => setLocationFilter({ kind: "all" })}
                />
              </div>
            ) : null}
          </header>

          <RecordsExplorerBulkBar
            count={selectedIds.size}
            filingEnabled={filingEnabled}
            onFileTo={() => {
              setFileToMode("add");
              setFileToDocs(selectedDocs);
            }}
            onChangeCategory={() => setCategoryDocs(selectedDocs)}
            onDownload={() => {
              for (const doc of selectedDocs) {
                if (doc.file_url) window.open(doc.file_url, "_blank");
              }
            }}
            onClear={() => setSelectedIds(new Set())}
            className="mb-2"
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {docsLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Loading documents…
              </p>
            ) : visibleDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <p className="text-sm text-foreground/90">{emptyMessage}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {locationFilter.kind !== "all" && activeLocationLabel ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setLocationFilter({ kind: "all" })}
                    >
                      Clear {activeLocationLabel}
                    </Button>
                  ) : null}
                  {category !== "all" && locationFilter.kind !== "all" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setLocationFilter({ kind: "all" })}
                    >
                      Show all {categoryTitle}
                    </Button>
                  ) : null}
                  {category !== "all" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setCategory("all")}
                    >
                      Show all records
                    </Button>
                  ) : null}
                  {filingEnabled ? (
                    <Button type="button" size="sm" onClick={onAddRecord}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add record
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <ul className="space-y-2 pb-2">
                {visibleDocs.map((doc) => (
                  <li key={doc.id}>{renderDocRow(doc, { showDragHandle: true })}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
          </>
        )}

        {/* Location drawer — browse or filing */}
        <PlacesDrawer
          open={locationDrawerOpen}
          onOpenChange={(open) => {
            setLocationDrawerOpen(open);
            if (!open) setLocationDrawerMode("browse");
          }}
          mode={locationDrawerMode}
          browseTitle="Locations"
          filingTitle="File to location"
        >
          {locationPanel}
        </PlacesDrawer>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag?.kind === "record" ? (
          <div className="rounded-[10px] bg-card px-3 py-2 text-sm font-medium shadow-md ring-2 ring-primary/50">
            {dragOverLabel ?? onboardingDragLabel(activeDrag)}
          </div>
        ) : null}
      </DragOverlay>

      <FileToSpacesDialog
        open={fileToDocs.length > 0}
        onOpenChange={(open) => {
          if (!open) setFileToDocs([]);
        }}
        documentTitle={
          fileToDocs.length === 1
            ? documentDisplayTitle(fileToDocs[0])
            : `${fileToDocs.length} documents`
        }
        spaces={spaces}
        linkedSpaceIds={
          fileToDocs.length === 1
            ? (fileToDocs[0].linked_spaces ?? []).map((s) => s.id)
            : []
        }
        mode={fileToMode}
        onSave={async (spaceIds) => {
          if (fileToMode === "add") {
            await onAddSpaceLinksBulk(fileToDocs, spaceIds);
          } else if (fileToDocs[0]) {
            await onSetSpaceLinks(fileToDocs[0], spaceIds);
          }
          setSelectedIds(new Set());
        }}
      />

      <ChangeCategoryDialog
        open={categoryDocs.length > 0}
        onOpenChange={(open) => {
          if (!open) setCategoryDocs([]);
        }}
        documentCount={categoryDocs.length}
        currentCategory={
          categoryDocs.length === 1 ? categoryDocs[0].category : null
        }
        onSave={async (nextCategory) => {
          await onChangeCategory(categoryDocs, nextCategory);
          setSelectedIds(new Set());
        }}
      />
    </DndContext>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        "inline-flex items-center gap-1 rounded-[8px] bg-primary/15 px-2 py-0.5",
        "font-mono text-2xs uppercase tracking-wide text-foreground",
        "shadow-[inset_0_0_0_1px_rgba(142,201,206,0.55)]",
        "hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      )}
    >
      {label}
      <X className="h-3 w-3 opacity-70" aria-hidden />
      <span className="sr-only">Clear {label}</span>
    </button>
  );
}
