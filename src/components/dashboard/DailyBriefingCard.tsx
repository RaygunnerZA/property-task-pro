import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { useGraphInsight } from "@/hooks/useGraphInsight";
import { useMemo } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { RadialProgress } from "@/components/ui/radial-progress";

interface DailyBriefingCardProps {
  showGreeting?: boolean;
  tasks?: any[];
  selectedPropertyIds?: Set<string>;
  properties?: any[];
  /** When set, shows property-specific insights (e.g. graph centrality) on the right */
  propertyId?: string;
  /** Scope label when in property context (e.g. property nickname) */
  scopeLabel?: string;
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
  scopeLabel,
}: DailyBriefingCardProps) {
  const filteredTasks = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0) {
      return tasks;
    }
    if (selectedPropertyIds.size === properties.length) {
      return tasks;
    }
    return tasks?.filter((task) => task.property_id && selectedPropertyIds.has(task.property_id)) || [];
  }, [tasks, selectedPropertyIds, properties.length]);

  const { focus, insight, context, loading } = useDailyBriefing(filteredTasks);
  const { centrality, loading: graphLoading } = useGraphInsight({
    start: propertyId ? { type: "property", id: propertyId } : null,
    depth: 3,
  });

  const selectedPropertyNames = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0) {
      return [];
    }
    if (selectedPropertyIds.size === properties.length) {
      return [];
    }
    return properties
      .filter((p) => selectedPropertyIds.has(p.id))
      .map((p) => p.nickname || p.address);
  }, [selectedPropertyIds, properties]);

  // Compute task-based metrics for radial (homepage or when no graph data)
  // Use full tasks list when showing "All Properties" so completed tasks aren't excluded by property filter
  const tasksForMetrics = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0 || selectedPropertyIds.size === properties.length) {
      return tasks ?? [];
    }
    return filteredTasks ?? [];
  }, [tasks, filteredTasks, selectedPropertyIds, properties.length]);

  const taskMetrics = useMemo(() => {
    const list = tasksForMetrics;
    const isCompleted = (t: any) => String(t?.status || "").toLowerCase() === "completed";
    const isArchived = (t: any) => String(t?.status || "").toLowerCase() === "archived";
    const activeList = list.filter((t) => !isArchived(t));
    const total = activeList.length;
    const done = activeList.filter(isCompleted).length;
    const urgent = list.filter((t) => t.priority === "urgent").length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const urgentPct = total > 0 ? Math.min(100, Math.round((urgent / total) * 100)) : 0;
    return { total, done, urgent, completionPct, urgentPct };
  }, [tasksForMetrics]);

  // Primary radial value: property context = centrality; homepage = completion %
  const radialValue = propertyId
    ? Math.round((centrality ?? 0) * 100)
    : taskMetrics.completionPct;
  const radialLabel = propertyId ? "Importance" : "Complete";

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

  const slides = [
    {
      id: "radial",
      value: radialValue,
      label: radialLabel,
      sublabel: propertyId
        ? "Graph centrality"
        : `${taskMetrics.done} of ${taskMetrics.total} tasks`,
    },
    // Future: add more slides (line chart, hazard exposure, etc.)
  ];

  return (
    <div className="w-full max-w-full">
      <div className="grid grid-cols-[1fr_auto] gap-4 h-[166px] max-h-[166px] items-start">
        {/* Left: Title + bullet observations */}
        <div className="min-w-0 flex flex-col justify-start">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-foreground">Overview</h2>
            {scopeLabel ? (
              <span className="text-lg font-normal text-[#8EC9CE] tracking-[0.1px]">
                | {scopeLabel}
              </span>
            ) : selectedPropertyNames.length === 0 ? (
              <span className="text-lg font-normal text-[#8EC9CE] tracking-[0.1px]">
                | All Properties
              </span>
            ) : (
              <span className="text-lg font-normal text-[#8EC9CE] tracking-[0.1px]">
                {selectedPropertyNames.map((name, index) => (
                  <span key={index}>
                    {index > 0 && " | "}
                    {name}
                  </span>
                ))}
              </span>
            )}
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

        {/* Right: Carousel with graphic data (radial, charts) */}
        <div className="flex-shrink-0 w-[200px] min-[1380px]:w-[220px] flex items-start justify-center">
          <Carousel
            opts={{ align: "center", loop: true, skipSnaps: true }}
            className="w-full"
          >
            <CarouselContent className="-ml-2">
              {slides.map((slide) => (
                <CarouselItem key={slide.id} className="pl-2 basis-auto">
                  <div className="flex flex-col items-center justify-center">
                    {propertyId && graphLoading ? (
                      <div className="w-[7rem] h-[7rem] rounded-full bg-muted/50 animate-pulse" />
                    ) : (
                      <RadialProgress
                        value={slide.value}
                        size={112}
                        thickness={22}
                        aria-label={`${slide.label}: ${slide.value}%`}
                      />
                    )}
                    <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider">
                      {slide.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {slide.sublabel}
                    </p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {slides.length > 1 && (
              <>
                <CarouselPrevious className="left-0 h-7 w-7 border-0 shadow-e1 bg-card hover:bg-muted/50" />
                <CarouselNext className="right-0 h-7 w-7 border-0 shadow-e1 bg-card hover:bg-muted/50" />
              </>
            )}
          </Carousel>
        </div>
      </div>
    </div>
  );
}
