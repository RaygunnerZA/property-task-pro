import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { format, format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cardButtonClassName } from "@/components/design-system/CardButton";
import { Skeleton } from "@/components/ui/skeleton";
import type { CaptionProps } from "react-day-picker";

interface LeftColumnProps {
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  propertiesLoading?: boolean;
}

/**
 * Left Column Component
 * Calendar + Properties
 * 
 * Desktop: Fixed 350px width, sticky on scroll
 * Mobile: Full width, stacked above RightColumn
 */
export function LeftColumn({ 
  tasks = [], 
  properties = [], 
  tasksLoading = false,
  propertiesLoading = false 
}: LeftColumnProps) {
  const { orgId } = useActiveOrg();
  const [showAddProperty, setShowAddProperty] = useState(false);

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

  // Extract task counts from properties_view (properties now have open_tasks_count)
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p: any) => {
      counts[p.id] = p.open_tasks_count || 0;
    });
    return counts;
  }, [properties]);

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


  // Custom CaptionLabel component that only shows month
  const CustomCaptionLabel = (props: { displayMonth: Date }) => {
    return (
      <span className="text-2xl font-semibold text-foreground">
        {formatDate(props.displayMonth, "MMMM")}
      </span>
    );
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Calendar Section - Fixed at top */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="px-4 pt-4 pb-4">
          {tasksLoading ? (
            <div className="rounded-lg bg-card p-3 shadow-e1">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="rounded-lg bg-card p-3 shadow-e1">
              <Calendar
                className="w-full"
                classNames={{
                  months: "flex flex-col space-y-4",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center mb-2",
                  caption_label: "text-2xl font-semibold text-foreground",
                  nav: "space-x-1 flex items-center",
                  nav_button: cardButtonClassName,
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex justify-center items-center",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] font-mono",
                  row: "flex w-full mt-2 mb-2 py-0 justify-center items-center font-mono",
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
                components={{
                  IconLeft: () => <ChevronLeft className="h-6 w-6 text-foreground" strokeWidth={2.5} />,
                  IconRight: () => <ChevronRight className="h-6 w-6 text-foreground" strokeWidth={2.5} />,
                  CaptionLabel: CustomCaptionLabel,
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
        <div className="sticky top-0 z-10 bg-background border-b border-border p-4 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Properties</h2>
            <button
              onClick={() => setShowAddProperty(true)}
              className="p-1.5 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200"
              aria-label="Add property"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-4">
          {propertiesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
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

      {/* Add Property Dialog */}
      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />
    </div>
  );
}

