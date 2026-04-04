import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { useGraphInsight } from "@/hooks/useGraphInsight";
import { useTasksForBriefingQuery } from "@/hooks/useTasksForBriefingQuery";
import { useCallback, useMemo, useState } from "react";
import { type CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { RadialProgress } from "@/components/ui/radial-progress";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DailyBriefingCardProps {
  showGreeting?: boolean;
  tasks?: any[];
  selectedPropertyIds?: Set<string>;
  properties?: any[];
  /** When set, shows property-specific insights (e.g. graph centrality) on the right */
  propertyId?: string;
}

/**
 * Daily Briefing Card
 *
 * Dashboard carousel specific to the screen it sits on.
 * - Homepage/Hub: observations on all properties
 * - Property detail: observations specific to that property
 *
 * Layout: Left = title + bullet observations. Right = carousel of graphic data
 * (radial progress, graphs). Merges Property Insights into the right side.
 */
export function DailyBriefingCard({
  showGreeting = true,
  tasks,
  selectedPropertyIds,
  properties = [],
  propertyId,
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
  const { centrality, loading: graphLoading } = useGraphInsight({
    start: effectivePropertyId ? { type: "property", id: effectivePropertyId } : null,
    depth: 3,
    enabled: false,
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

  // Call all hooks unconditionally to avoid "Rendered fewer hooks than expected"
  const carouselOpts = useMemo(() => ({ align: "start" as const, loop: true, skipSnaps: false }), []);

  // Primary radial value: property context = centrality; homepage = completion %
  const radialValue = effectivePropertyId
    ? Math.round((centrality ?? 0) * 100)
    : taskMetrics.completionPct;
  const radialLabel = effectivePropertyId ? "Importance" : "Complete";

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-[166px] rounded-lg bg-muted/50" />
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
      sublabel: effectivePropertyId
        ? "Graph centrality"
        : `${taskMetrics.done} of ${taskMetrics.total} tasks`,
    },
    {
      id: "focus",
      value: focusPct,
      label: "Due today",
      sublabel: `${focus} of ${totalActive} tasks`,
    },
  ];

  return (
    <div className="w-full max-w-full">
      <div className="grid grid-cols-[1fr_1fr] gap-4 h-[166px] max-h-[166px] items-start">
        {/* Left half: Title + bullet observations (briefing points) */}
        <div className="min-w-0 flex flex-col justify-start pt-1">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-foreground">Overview</h2>
          </div>
          <ul className="space-y-2">
            {observations.length > 0 ? (
              observations.map((obs, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-primary">•</span>
                  <span>{obs}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No observations available</li>
            )}
          </ul>
        </div>

        {/* Right half: Carousel with graphic data (radial, charts) + discrete chevrons */}
        <div className="min-w-0 flex w-[300px] gap-0 items-start justify-center relative">
          <Carousel
            opts={carouselOpts}
            setApi={handleCarouselApi}
            className="w-full max-w-[300px]"
          >
            <CarouselContent className="ml-0 justify-center items-center gap-1 w-[300px]">
              {slides.map((slide) => (
                <CarouselItem
                  key={slide.id}
                  className="pl-0 basis-[115px] w-[115px] flex-none min-w-0 font-medium"
                >
                  <div className="flex flex-col items-center justify-center w-[115px] h-[165px]">
                    {effectivePropertyId && graphLoading && slide.id === "radial" ? (
                      <div className="w-[7rem] h-[7rem] rounded-full bg-muted/50 animate-pulse" />
                    ) : (
                      <RadialProgress
                        value={slide.value}
                        size={90}
                        thickness={10}
                        aria-label={`${slide.label}: ${slide.value}%`}
                      />
                    )}
                    <p
                      className={cn(
                        "text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider",
                        "text-shadow-neu-pressed"
                      )}
                    >
                      {slide.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {slide.sublabel}
                    </p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          {/* Discrete chevrons to select previous/next slide */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none px-0 pb-[38px]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); carouselApi?.scrollPrev(); }}
              disabled={!carouselApi?.canScrollPrev}
              aria-label="Previous slide"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border-0 shadow-none bg-transparent hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
            >
              <ChevronLeft className="h-[35px] w-[35px] text-primary" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); carouselApi?.scrollNext(); }}
              disabled={!carouselApi?.canScrollNext}
              aria-label="Next slide"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border-0 shadow-none bg-transparent hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
            >
              <ChevronRight className="h-4 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
