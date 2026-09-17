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
import { MapPin, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  filterExplorerDocuments,
} from "@/lib/records/explorerFilters";
import { RecordsCategoryCarousel } from "@/components/records/RecordsCategoryCarousel";
import { RecordsExplorerCategoryCard } from "@/components/records/RecordsExplorerCategoryCard";
import { RecordsLocationTree } from "@/components/records/RecordsLocationTree";
import { RecordsExplorerDocumentRow } from "@/components/records/RecordsExplorerDocumentRow";
import { RecordsExplorerBulkBar } from "@/components/records/RecordsExplorerBulkBar";
import { FileToSpacesDialog } from "@/components/records/FileToSpacesDialog";
import { ChangeCategoryDialog } from "@/components/records/ChangeCategoryDialog";

const ATTENTION_FILTERS: { id: ExplorerAttentionFilter; label: string }[] = [
  { id: "all", label: "All" },
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
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
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
  searchQuery: searchProp,
  onSearchQueryChange,
  className,
}: RecordsExplorerProps) {
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

  const visibleDocs = useMemo(
    () =>
      filterExplorerDocuments(documents, {
        category,
        location: locationFilter,
        attention,
        search,
      }).sort((a, b) =>
        documentDisplayTitle(a).localeCompare(documentDisplayTitle(b))
      ),
    [documents, category, locationFilter, attention, search]
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

  const locationPanel = (
    <RecordsLocationTree
      areas={areas}
      roomsByAreaId={roomsByAreaId}
      unassignedRooms={unassignedRooms}
      docCountBySpaceId={docCountBySpaceId}
      propertyLevelCount={propertyLevelCount}
      locationFilter={locationFilter}
      onSelectLocation={handleSelectLocation}
      filingEnabled={filingEnabled}
      mode={locationDrawerMode}
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
        {/* Compact category carousel */}
        <RecordsCategoryCarousel>
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
        </RecordsCategoryCarousel>

        {/* Full-width document workspace */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[12px] bg-card/55 p-3 shadow-e1 sm:p-4">
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

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents"
                  className="h-8 border-0 bg-background/80 pl-8 text-sm shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus-visible:ring-1 focus-visible:ring-primary/40"
                  aria-label="Search documents"
                />
              </div>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Attention filters"
              >
                {ATTENTION_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAttention(f.id)}
                    className={cn(
                      "rounded-[8px] px-2.5 py-1 font-mono text-2xs uppercase tracking-wide transition-colors",
                      attention === f.id
                        ? "bg-primary/20 text-foreground shadow-[inset_0_0_0_1px_rgba(142,201,206,0.7)]"
                        : "bg-background/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
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
            </div>

            {(category !== "all" ||
              locationFilter.kind !== "all" ||
              attention !== "all") && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  Active filters:
                </span>
                {category !== "all" ? (
                  <FilterChip
                    label={categoryTitle}
                    onClear={() => setCategory("all")}
                  />
                ) : null}
                {activeLocationLabel ? (
                  <FilterChip
                    label={activeLocationLabel}
                    onClear={() => setLocationFilter({ kind: "all" })}
                  />
                ) : null}
                {attention !== "all" ? (
                  <FilterChip
                    label={
                      ATTENTION_FILTERS.find((f) => f.id === attention)?.label ??
                      attention
                    }
                    onClear={() => setAttention("all")}
                  />
                ) : null}
              </div>
            )}
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
                  <li key={doc.id}>
                    <RecordsExplorerDocumentRow
                      document={doc}
                      selected={selectedIds.has(doc.id)}
                      onSelectedChange={(next) => toggleSelected(doc.id, next)}
                      filingEnabled={filingEnabled}
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Location drawer — browse or filing */}
        <Sheet
          open={locationDrawerOpen}
          onOpenChange={(open) => {
            setLocationDrawerOpen(open);
            if (!open) setLocationDrawerMode("browse");
          }}
        >
          <SheetContent
            side="right"
            className="w-[min(100%,380px)] border-l-0 bg-[hsl(var(--background))] p-4 shadow-e2 sm:max-w-md"
          >
            <SheetHeader className="mb-3">
              <SheetTitle className="text-base">
                {locationDrawerMode === "filing" ? "File to location" : "Locations"}
              </SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100vh-6rem)]">{locationPanel}</div>
          </SheetContent>
        </Sheet>
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
