import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { useTasks } from "@/hooks/use-tasks";
import { useProperties } from "@/hooks/useProperties";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

/**
 * Left Column Component
 * Calendar + Properties
 * 
 * Desktop: Fixed 350px width, sticky on scroll
 * Mobile: Full width, stacked above RightColumn
 */
export function LeftColumn() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { properties, loading: propertiesLoading } = useProperties();
  const { orgId } = useActiveOrg();
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  // Create a map of dates to task counts
  const tasksByDate = useMemo(() => {
    const map = new Map<string, number>();
    
    tasks.forEach((task) => {
      if (task.due_date) {
        try {
          const date = new Date(task.due_date);
          const dateKey = format(date, "yyyy-MM-dd");
          map.set(dateKey, (map.get(dateKey) || 0) + 1);
        } catch {
          // Skip invalid dates
        }
      }
    });

    return map;
  }, [tasks]);

  // Get dates that have tasks for styling
  const datesWithTasks = useMemo(() => {
    return Array.from(tasksByDate.keys()).map((key) => {
      try {
        const [year, month, day] = key.split("-").map(Number);
        return new Date(year, month - 1, day);
      } catch {
        return null;
      }
    }).filter((date): date is Date => date !== null);
  }, [tasksByDate]);

  // Fetch task counts for properties
  useEffect(() => {
    if (!orgId || properties.length === 0) {
      setTaskCounts({});
      return;
    }

    async function fetchTaskCounts() {
      try {
        const propertyIds = properties.map(p => p.id);
        
        const { data, error } = await supabase
          .from("tasks")
          .select("property_id")
          .eq("org_id", orgId)
          .in("property_id", propertyIds)
          .not("property_id", "is", null);

        if (error) {
          console.error("Error fetching task counts:", error);
          return;
        }

        // Count tasks per property
        const counts: Record<string, number> = {};
        (data || []).forEach((task) => {
          if (task.property_id) {
            counts[task.property_id] = (counts[task.property_id] || 0) + 1;
          }
        });

        setTaskCounts(counts);
      } catch (err) {
        console.error("Error fetching task counts:", err);
      }
    }

    fetchTaskCounts();
  }, [orgId, properties]);

  return (
    <div className="h-screen bg-card flex flex-col overflow-hidden">
      {/* Calendar Section - Fixed at top */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="p-4 pb-3">
          <h2 className="text-lg font-semibold text-foreground mb-4">Calendar</h2>
        </div>
        <div className="px-4 pb-4">
          {tasksLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">Loading calendar...</p>
            </div>
          ) : (
            <div className="rounded-lg bg-background p-3 shadow-e1">
              <Calendar
                className="w-full"
                classNames={{
                  months: "flex flex-col space-y-4",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center mb-2",
                  caption_label: "text-sm font-semibold text-foreground",
                  nav: "space-x-1 flex items-center",
                  nav_button: cn(
                    "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-md hover:bg-accent transition-colors"
                  ),
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] font-mono",
                  row: "flex w-full mt-2 mb-2 py-0 justify-start items-start font-mono",
                  cell: "h-9 w-9 text-center text-sm p-0 relative font-mono",
                  day: "h-9 w-9 p-0 font-normal font-mono relative rounded-full flex items-center justify-center",
                  day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
                  day_today: "bg-accent/30 text-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_hidden: "invisible",
                }}
                modifiers={{
                  hasTasks: datesWithTasks,
                }}
                modifiersClassNames={{
                  hasTasks: "has-tasks",
                }}
              />
              <style>{`
                .rdp-day.has-tasks::after {
                  content: '';
                  position: absolute;
                  bottom: 2px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 4px;
                  height: 4px;
                  border-radius: 50%;
                  background-color: #8EC9CE;
                }
                .rdp-day_selected.has-tasks::after {
                  background-color: white;
                }
                .rdp-day.has-tasks.rdp-day_today::after {
                  background-color: #EB6834;
                }
              `}</style>
            </div>
          )}
        </div>
      </div>

      {/* Properties Section - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4 pb-3">
          <h2 className="text-lg font-semibold text-foreground">Properties</h2>
        </div>
        <div className="p-4">
          {propertiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Loading properties...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No properties yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={{
                    ...property,
                    taskCount: taskCounts[property.id] || 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

