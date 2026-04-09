import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { useTasksForBriefingQuery } from "@/hooks/useTasksForBriefingQuery";
import { useCallback, useMemo, useState } from "react";
import { type CarouselApi, Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { RadialProgress } from "@/components/ui/radial-progress";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DailyBriefingCardProps {
  showGreeting?: boolean;
  tasks?: any[];
  selectedPropertyIds?: Set<string>;
  properties?: any[];
  /** When set, scopes task metrics (e.g. completion radial) to that property */
  propertyId?: string;
  /**
   * full: hub header layout (Overview + carousel radials) above workbench tabs.
   * sidebar: compact stacked layout (used where space is tight).
   */
  variant?: "full" | "sidebar";
}

/**
 * Daily Briefing Card
 *
 * Dashboard carousel specific to the screen it sits on.
 * - Homepage/Hub: observations on all properties
 * - Property detail: observations specific to that property
 *
 * Layout: Left = title + bullet observations. Right = one radial at a time (carousel)
 * with chevrons between Complete and Due today. Sidebar variant keeps two radials stacked row.
 */
export function DailyBriefingCard({
  showGreeting = true,
  tasks,
  selectedPropertyIds,
  properties = [],
  propertyId,
  variant = "full",
}: DailyBriefingCardProps) {
  const [carouselApi, setCarouselApi] = useState<{ scrollPrev: () => void; scrollNext: () => void; canScrollPrev: boolean; canScrollNext: boolean } | null>(null);

  // When exactly one property is selected on the dashboard, show property stats (centrality).
  // Otherwise use explicit propertyId (e.g. Property detail page) or multiproperty stats.
  const effectivePropertyId = useMemo(() => {
    if (propertyId) return propertyId;
    if (selectedPropertyIds?.size === 1) return Array.from(selectedPropertyIds)[0];
    return undefined;
  }, [propertyId, selectedPropertyIds]);

  // Disabled: no immediate requests from the card; use parent-provided tasks for metrics
  const { data: fullTasksFromApi = [] } = useTasksForBriefingQuery(
    effectivePropertyId ?? undefined,
    { enabled: false }
  );

  const filteredTasks = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0) {
      return tasks;
    }
    if (selectedPropertyIds.size === properties.length) {
      return tasks;
    }
    return tasks?.filter((task) => task.property_id && selectedPropertyIds.has(task.property_id)) || [];
  }, [tasks, selectedPropertyIds, properties.length]);

  const { focus, insight, context, loading } = useDailyBriefing(filteredTasks, {
    skipNetworkRequests: true,
  });

  // Use full API task list when available; otherwise use parent-provided tasks for radial metrics
  const tasksForMetrics = useMemo(() => {
    const full = (fullTasksFromApi ?? []).length > 0 ? fullTasksFromApi : (filteredTasks ?? []);
    if (!effectivePropertyId) {
      if (!selectedPropertyIds || selectedPropertyIds.size === 0 || selectedPropertyIds.size === properties.length) {
        return full;
      }
      return full.filter((t: any) => t.property_id && selectedPropertyIds.has(t.property_id));
    }
    return full.filter((t: any) => t.property_id === effectivePropertyId);
  }, [fullTasksFromApi, filteredTasks, effectivePropertyId, selectedPropertyIds, properties.length]);

  const taskMetrics = useMemo(() => {
    const list = tasksForMetrics;
    const isCompleted = (t: any) => String(t?.status || "").toLowerCase() === "completed";
    const isArchived = (t: any) => String(t?.status || "").toLowerCase() === "archived";
    const activeList = list.filter((t) => !isArchived(t));
    const total = activeList.length;
    const done = activeList.filter(isCompleted).length;
    const urgent = list.filter((t) => String(t?.priority || "").toLowerCase() === "urgent").length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const urgentPct = total > 0 ? Math.min(100, Math.round((urgent / total) * 100)) : 0;
    return { total, done, urgent, completionPct, urgentPct };
  }, [tasksForMetrics]);

  const handleCarouselApi = useCallback((api: CarouselApi | null) => {
    if (!api) return;
    setCarouselApi({
      scrollPrev: api.scrollPrev,
      scrollNext: api.scrollNext,
      canScrollPrev: api.canScrollPrev(),
      canScrollNext: api.canScrollNext(),
    });
    api.on("select", () => {
      setCarouselApi((prev) => prev ? {
        ...prev,
        canScrollPrev: api.canScrollPrev(),
        canScrollNext: api.canScrollNext(),
      } : null);
    });
  }, []);

  const carouselOptsSingle = useMemo(
    () => ({ align: "center" as const, loop: true, skipSnaps: false }),
    []
  );

  const radialValue = taskMetrics.completionPct;
  const radialLabel = "Complete";

  if (loading) {
    const h = variant === "sidebar" ? "min-h-[220px]" : "h-[166px]";
    return (
      <div className="animate-pulse">
        <div className={cn("rounded-xl bg-muted/50", h)} />
      </div>
    );
  }

  const observations: string[] = [];
  if (insight) observations.push(insight);
  if (context) observations.push(context);
  if (focus > 0) observations.push(`${focus} task${focus !== 1 ? "s" : ""} due today`);

  const totalActive = taskMetrics.total;
  const focusPct = totalActive > 0 && focus > 0 ? Math.min(100, Math.round((focus / totalActive) * 100)) : 0;

  // Right column: exactly 2 graphics (no more)
  const slides = [
    {
      id: "radial",
      value: radialValue,
      label: radialLabel,
      sublabel: `${taskMetrics.done} of ${taskMetrics.total} tasks`,
    },
    {
      id: "focus",
      value: focusPct,
      label: "Due today",
      sublabel: `${focus} of ${totalActive} tasks`,
    },
  ];

  const renderHubRadialSlide = (slide: (typeof slides)[number]) => (
    <div className="flex flex-col items-center justify-center w-[115px] h-[165px] mx-auto">
      <RadialProgress
        value={slide.value}
        size={90}
        thickness={10}
        innerDiscSize={70}
        labelMarginLeft={9}
        aria-label={`${slide.label}: ${slide.value}%`}
      />
      <p
        className={cn(
          "text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider",
          "text-shadow-neu-pressed"
        )}
      >
        {slide.label}
      </p>
      <p className="text-[10px] text-muted-foreground/80 mt-0.5">{slide.sublabel}</p>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "w-full rounded-xl bg-transparent px-3 py-3",
          "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_8px_0px_rgba(255,255,255,0.9)]"
        )}
      >
        <PanelSectionTitle as="h2">Overview</PanelSectionTitle>
        <ul className="space-y-1.5 mb-3 min-w-0">
          {observations.length > 0 ? (
            observations.map((obs, index) => (
              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2 leading-snug">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-[rgba(143,141,138,1)]">{obs}</span>
              </li>
            ))
          ) : (
            <li className="text-xs text-muted-foreground">No observations available</li>
          )}
        </ul>
        <div className="flex w-full gap-2 pt-3 border-t border-border/30">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-start"
            >
              <div className="flex w-full justify-center">
                <RadialProgress
                  value={slide.value}
                  size={112}
                  thickness={11}
                  embed
                  aria-label={`${slide.label}: ${slide.value}%`}
                />
              </div>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center mt-0.5 text-shadow-neu-pressed">
                {slide.label}
              </p>
              <p className="text-[9px] text-muted-foreground/80 text-center leading-tight px-0.5 mt-0.5">
                {slide.sublabel}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full">
      <div
        className={cn(
          "grid items-start",
          /* Mobile: 50% Overview + bullets | 50% one radial + < >; md+: same split, fixed right width */
          "grid-cols-2 gap-2 md:gap-4 md:grid-cols-[1fr_1fr]",
          "md:h-[166px] md:max-h-[166px]"
        )}
      >
        {/* Left: Title + bullet observations (briefing points) */}
        <div className="min-w-0 flex flex-col justify-start pt-1 pr-1 md:pr-0">
          <PanelSectionTitle as="h2" className="max-md:mb-1 max-md:text-sm">
            Overview
          </PanelSectionTitle>
          <ul className="space-y-1.5 md:space-y-2">
            {observations.length > 0 ? (
              observations.map((obs, index) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground flex items-start gap-1.5 md:items-center md:gap-2 leading-snug"
                >
                  <span className="text-primary shrink-0 mt-0.5 md:mt-0">•</span>
                  <span className="min-w-0 break-words">{obs}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No observations available</li>
            )}
          </ul>
        </div>

        {/* Right: one radial at a time; < > switch Complete vs Due today */}
        <div
          className={cn(
            "min-w-0 flex gap-0 items-start justify-center relative",
            "w-full shrink-0 max-md:max-w-none md:max-w-[300px] md:w-[300px] md:mx-0"
          )}
        >
          <Carousel
            key="briefing-carousel-single"
            opts={carouselOptsSingle}
            setApi={handleCarouselApi}
            className="w-full min-w-0"
          >
            <CarouselContent className="ml-0 -ml-0 justify-center items-center w-full min-w-0">
              {slides.map((slide) => (
                <CarouselItem
                  key={slide.id}
                  className="pl-0 basis-full min-w-0 flex-none font-medium"
                >
                  {renderHubRadialSlide(slide)}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none px-0 pb-[38px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                carouselApi?.scrollPrev();
              }}
              disabled={!carouselApi?.canScrollPrev}
              aria-label="Previous slide"
              className={cn(
                "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border-0 shadow-none",
                "bg-transparent hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
              )}
            >
              <ChevronLeft className="h-[35px] w-[35px] text-primary" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                carouselApi?.scrollNext();
              }}
              disabled={!carouselApi?.canScrollNext}
              aria-label="Next slide"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border-0 shadow-none bg-transparent hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
            >
              <ChevronRight className="h-[35px] w-[35px] text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
