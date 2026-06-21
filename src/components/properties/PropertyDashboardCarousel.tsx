import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertySummaryPanel } from "@/components/properties/PropertySummaryPanel";
import { PropertySelectorAllThumbnail } from "@/components/properties/PropertySelectorAllThumbnail";
import {
  countPropertyPeople,
  type PropertyHubNavCardId,
} from "@/components/properties/PropertyHubNavCards";
import type { PropertyForStrip } from "@/components/properties/PropertyIdentityStrip";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import {
  propertyHubIssuesPath,
  propertyHubPath,
  propertyHubRecordsPath,
  propertyHubSpacesPath,
  propertyHubAssetsPath,
  propertyHubPeoplePath,
  WORKBENCH_ISSUES_FILTER_QUERY,
  WORKBENCH_TASK_PRIORITY_QUERY,
} from "@/lib/propertyRoutes";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { computeAllPropertiesSummaryMetrics } from "@/lib/propertySummaryMetrics";
import { getAllPropertiesSummaryLines } from "@/lib/propertyAiSummary";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { useTrackpadCarouselWheel } from "@/hooks/useTrackpadHorizontalScroll";
import { cn } from "@/lib/utils";

const EMBLA_OPTS = {
  align: "start" as const,
  loop: false,
  containScroll: "trimSnaps" as const,
  dragFree: false,
  skipSnaps: false,
  dragThreshold: 22,
};

/** Slide width — leaves ~15% of the column visible as a peek of the next card */
const SLIDE_BASIS = "basis-[85%]";

const VIEWPORT_DRAG_CLASS =
  "touch-pan-x cursor-grab select-none overscroll-x-contain active:cursor-grabbing [-webkit-user-drag:none]";

const ALL_PROPERTIES_SLIDE_ID = "__all_properties__";

type PropertyDashboardCarouselProps = {
  properties: PropertyForStrip[];
  tasks?: unknown[];
  loading?: boolean;
  selectedPropertyIds: Set<string>;
  urgentTaskCounts?: Record<string, number>;
  onPropertySelectionChange?: (propertyIds: Set<string>) => void;
  onFilterClick?: (filterId: string) => void;
  className?: string;
};

function AllPropertiesCarouselSlide({
  properties,
  tasks = [],
  urgentTaskCounts = {},
  onFilterClick,
  isSelected = false,
  onSelectSlide,
}: {
  properties: PropertyForStrip[];
  tasks?: unknown[];
  urgentTaskCounts?: Record<string, number>;
  onFilterClick?: (filterId: string) => void;
  isSelected?: boolean;
  onSelectSlide?: () => void;
}) {
  const totalUrgent = useMemo(
    () => Object.values(urgentTaskCounts).reduce((sum, n) => sum + n, 0),
    [urgentTaskCounts]
  );

  const metrics = useMemo(
    () =>
      computeAllPropertiesSummaryMetrics(
        properties,
        tasks as Parameters<typeof computeAllPropertiesSummaryMetrics>[1],
        totalUrgent
      ),
    [properties, tasks, totalUrgent]
  );

  const summaryLines = useMemo(
    () =>
      getAllPropertiesSummaryLines(
        tasks as Parameters<typeof getAllPropertiesSummaryLines>[0],
        properties.length
      ),
    [tasks, properties.length]
  );

  const placeholderProperty = properties[0];

  if (!placeholderProperty) return null;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[12px] border bg-card/60 shadow-[1px_1px_2px_0px_rgba(0,0,0,0.05),inset_1px_1px_1px_0px_rgba(255,255,255,0.65)] transition-shadow",
        isSelected ? "border-primary/50 ring-2 ring-primary/40" : "border-border/20"
      )}
    >
      <button
        type="button"
        onClick={onSelectSlide}
        aria-pressed={isSelected}
        aria-label="Select all properties view"
        className="relative flex w-full shrink-0 flex-col items-center justify-end overflow-hidden px-4 pb-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{
          height: "160px",
          background:
            "linear-gradient(135deg, rgba(142, 201, 206, 0.85) 0%, rgba(58, 74, 106, 0.92) 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <PropertySelectorAllThumbnail properties={properties} size="header" className="mx-auto mt-6" />
        </div>
        <div className="relative z-10 flex w-full min-w-0 flex-col items-center text-center">
          <Building2 className="mb-1.5 h-6 w-6 text-white/90" strokeWidth={1.75} aria-hidden />
          <p className="text-[18px] font-semibold leading-tight text-white drop-shadow-sm">
            All properties
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-white/85">
            {properties.length} {properties.length === 1 ? "property" : "properties"} in your portfolio
          </p>
        </div>
      </button>

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
          variant="compact"
          property={placeholderProperty}
          tasks={tasks}
          documents={[]}
          metricsOverride={metrics}
          summaryLinesOverride={summaryLines}
          urgentOpenTaskCount={totalUrgent}
          onOpenUrgent={() => onFilterClick?.("show-tasks-urgent")}
          onOpenTasks={() => onFilterClick?.("show-tasks")}
          onOpenCompliance={() => onFilterClick?.("filter-date-overdue")}
          onOpenInspections={() => onFilterClick?.("filter-date-this-week")}
        />
      </div>
    </div>
  );
}

function PropertyCarouselSlide({
  property,
  urgentOpenTaskCount = 0,
  onFilterClick,
  isSelected = false,
  onSelectSlide,
}: {
  property: PropertyForStrip;
  urgentOpenTaskCount?: number;
  onFilterClick?: (filterId: string) => void;
  isSelected?: boolean;
  onSelectSlide?: () => void;
}) {
  const navigate = useNavigate();
  const { documents: propertyDocuments = [] } = usePropertyDocuments(property.id, undefined, {
    limit: 500,
  });
  const { data: propertyTasksView = [] } = useTasksQuery(property.id);
  const { members } = useOrgMembers();

  const displayName = property.nickname || property.address;
  const iconColor = property.icon_color_hex || "#8EC9CE";
  const IconComponent = getPropertyChipIcon(property.icon_name);

  const peopleCount = useMemo(
    () => countPropertyPeople(property.id, property.owner_name, property.contact_name, members),
    [property.id, property.owner_name, property.contact_name, members]
  );

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
    <div
      className={cn(
        "w-full overflow-hidden rounded-[12px] border bg-card/60 shadow-[1px_1px_2px_0px_rgba(0,0,0,0.05),inset_1px_1px_1px_0px_rgba(255,255,255,0.65)] transition-shadow",
        isSelected ? "border-primary/50 ring-2 ring-primary/40" : "border-border/20"
      )}
    >
      <button
        type="button"
        onClick={onSelectSlide}
        aria-pressed={isSelected}
        aria-label={`Select ${displayName}`}
        className="relative block w-full shrink-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{
          height: "160px",
          backgroundColor: property.thumbnail_url ? undefined : iconColor,
        }}
      >
        {property.thumbnail_url ? (
          <img
            src={property.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(0deg, rgba(0, 0, 0, 0.65) 22%, rgba(0, 0, 0, 0) 48%, rgba(0, 0, 0, 0) 100%)",
          }}
        />

        <div className="absolute bottom-2 left-2.5 right-2.5 z-10 min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <IconComponent
              className="h-5 w-5 shrink-0 drop-shadow-sm stroke-[1.75]"
              style={{ color: iconColor }}
              aria-hidden
            />
            <p className="min-w-0 truncate text-[18px] font-semibold leading-tight text-white drop-shadow-sm">
              {displayName}
            </p>
          </div>
          {property.address ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-white/90 drop-shadow-sm">
              {property.address}
            </p>
          ) : null}
        </div>
      </button>

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
          variant="compact"
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
            onFilterClick
              ? onFilterClick("show-tasks")
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
  );
}

export function PropertyDashboardCarousel({
  properties,
  tasks = [],
  loading = false,
  selectedPropertyIds,
  urgentTaskCounts = {},
  onPropertySelectionChange,
  onFilterClick,
  className,
}: PropertyDashboardCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  useTrackpadCarouselWheel(api);

  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const showAllSlide = properties.length > 1;

  const slides = useMemo(() => {
    if (showAllSlide) {
      return [{ id: ALL_PROPERTIES_SLIDE_ID, type: "all" as const }, ...properties.map((p) => ({ id: p.id, type: "property" as const, property: p }))];
    }
    return properties.map((p) => ({ id: p.id, type: "property" as const, property: p }));
  }, [properties, showAllSlide]);

  const selectedCarouselIndex = useMemo(() => {
    if (showAllSlide && isAllPropertiesActive(selectedPropertyIds, allPropertyIds)) {
      return 0;
    }
    if (selectedPropertyIds.size === 1) {
      const id = Array.from(selectedPropertyIds)[0];
      const propertyIndex = properties.findIndex((p) => p.id === id);
      if (propertyIndex >= 0) {
        return showAllSlide ? propertyIndex + 1 : propertyIndex;
      }
    }
    return 0;
  }, [allPropertyIds, properties, selectedPropertyIds, showAllSlide]);

  const commitSelectionAtIndex = useCallback(
    (index: number) => {
      if (!onPropertySelectionChange) return;

      if (showAllSlide && index === 0) {
        onPropertySelectionChange(new Set(allPropertyIds));
        return;
      }

      const propertyIndex = showAllSlide ? index - 1 : index;
      const property = properties[propertyIndex];
      if (property) {
        onPropertySelectionChange(new Set([property.id]));
      }
    },
    [allPropertyIds, onPropertySelectionChange, properties, showAllSlide]
  );

  const handleExplicitSelect = useCallback(
    (index: number) => {
      commitSelectionAtIndex(index);
      api?.scrollTo(index);
      setActiveIndex(index);
    },
    [api, commitSelectionAtIndex]
  );

  useEffect(() => {
    if (!api) return;
    api.scrollTo(selectedCarouselIndex, false);
    setActiveIndex(selectedCarouselIndex);
  }, [api, selectedCarouselIndex]);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setActiveIndex(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const scrollToIndex = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  if (loading) {
    return <Skeleton className={cn("h-[320px] w-[85%] rounded-xl", className)} />;
  }

  if (properties.length === 0) return null;

  return (
    <div className={cn("w-full min-w-0", className)} aria-label="Property dashboards">
      <Carousel setApi={setApi} opts={EMBLA_OPTS} className="w-full">
        <CarouselContent className="ml-0" viewportClassName={VIEWPORT_DRAG_CLASS}>
          {showAllSlide ? (
            <CarouselItem key={ALL_PROPERTIES_SLIDE_ID} className={cn(SLIDE_BASIS, "min-w-0 shrink-0 grow-0 pl-0 pr-2.5")}>
              <AllPropertiesCarouselSlide
                properties={properties}
                tasks={tasks}
                urgentTaskCounts={urgentTaskCounts}
                onFilterClick={onFilterClick}
                isSelected={selectedCarouselIndex === 0}
                onSelectSlide={() => handleExplicitSelect(0)}
              />
            </CarouselItem>
          ) : null}
          {properties.map((property, propertyIndex) => {
            const slideIndex = showAllSlide ? propertyIndex + 1 : propertyIndex;
            return (
            <CarouselItem
              key={property.id}
              className={cn(SLIDE_BASIS, "min-w-0 shrink-0 grow-0 pl-0 pr-2.5")}
            >
              <PropertyCarouselSlide
                property={property}
                urgentOpenTaskCount={urgentTaskCounts[property.id] ?? 0}
                onFilterClick={onFilterClick}
                isSelected={selectedCarouselIndex === slideIndex}
                onSelectSlide={() => handleExplicitSelect(slideIndex)}
              />
            </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {slides.length > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((slide, index) => {
            const label =
              slide.type === "all"
                ? "All properties"
                : `Go to ${slide.property.nickname || slide.property.address}`;
            return (
              <button
                key={slide.id}
                type="button"
                aria-label={label}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => scrollToIndex(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === selectedCarouselIndex
                    ? "w-4 bg-primary"
                    : index === activeIndex
                      ? "w-3 bg-primary/40"
                      : "w-1.5 bg-muted-foreground/30"
                )}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
