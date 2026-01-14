import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { useMemo } from "react";

interface DailyBriefingCardProps {
  showGreeting?: boolean;
  tasks?: any[]; // Optional tasks to use instead of fetching all tasks
  selectedPropertyIds?: Set<string>;
  properties?: any[];
}

/**
 * Daily Briefing Component
 * 
 * Overview of all properties with AI observations
 * Contents sit directly on background (no card styling)
 */
export function DailyBriefingCard({ showGreeting = true, tasks, selectedPropertyIds, properties = [] }: DailyBriefingCardProps) {
  // Filter tasks by selected properties
  const filteredTasks = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0) {
      return tasks;
    }
    // If all properties are selected, return all tasks
    if (selectedPropertyIds.size === properties.length) {
      return tasks;
    }
    return tasks?.filter(task => task.property_id && selectedPropertyIds.has(task.property_id)) || [];
  }, [tasks, selectedPropertyIds, properties.length]);

  const { focus, insight, context, loading } = useDailyBriefing(filteredTasks);

  // Get selected property names
  const selectedPropertyNames = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0) {
      return [];
    }
    // If all properties are selected, return empty array (will show "All Properties")
    if (selectedPropertyIds.size === properties.length) {
      return [];
    }
    return properties
      .filter(p => selectedPropertyIds.has(p.id))
      .map(p => p.nickname || p.address);
  }, [selectedPropertyIds, properties]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-muted/50 rounded-lg" />
      </div>
    );
  }

  // Prepare AI observations for overview
  const observations = [];
  if (insight) observations.push(insight);
  if (context) observations.push(context);
  if (focus > 0) observations.push(`${focus} task${focus !== 1 ? 's' : ''} due today`);

  return (
    <div className="w-full max-w-full pb-6 pt-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            Overview
          </h2>
          {selectedPropertyNames.length === 0 ? (
            <span className="text-lg font-normal text-[#8EC9CE] tracking-[0.1px]">| All Properties</span>
          ) : (
            <span className="text-lg font-normal text-[#8EC9CE] tracking-[0.1px]">
              {selectedPropertyNames.map((name, index) => (
                <span key={index}>
                  {index > 0 && ' | '}
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
    </div>
  );
}
