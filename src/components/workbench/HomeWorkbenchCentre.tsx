import { Tabs, TabsList, TabsTrigger } from "@/components/ui/animated-tabs";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { IntakeActionButtonPair } from "@/components/intake/IntakeActionButton";
import { MyWorkPanel, type MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import { Calendar, CheckSquare, ShieldCheck } from "lucide-react";

export interface HomeWorkbenchCentreProps extends MyWorkPanelProps {
  onTabChange?: (tab: string) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
}

const taskToolbarRecessedClass =
  "rounded-[15px] bg-background overflow-visible " +
  "shadow-[-1px_-1px_1px_0px_rgba(0,0,0,0.1),1px_1px_1px_0px_rgba(255,255,255,0.8),inset_2px_12.9px_11px_-5.2px_rgba(0,0,0,0.3),inset_0px_-5.7px_5.9px_0px_rgba(255,255,255,0)]";

const taskTabShell =
  "rounded-[8px] transition-all text-sm font-medium min-w-0 group/task-tab inline-flex items-center justify-center " +
  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)] " +
  "data-[state=active]:bg-card data-[state=inactive]:bg-transparent data-[state=active]:text-[rgb(20,184,166)]";

const taskTabPadLabeled =
  "w-auto min-w-min shrink-0 px-1.5 sm:px-2 lg:px-2.5 max-pane:px-1 max-sm:flex-1 max-sm:basis-0 max-sm:min-w-0 max-sm:justify-center";

/**
 * Home workbench centre: My Work (default) + navigation to Records / Schedule.
 */
export function HomeWorkbenchCentre({
  onTabChange,
  onOpenIntake,
  ...myWorkProps
}: HomeWorkbenchCentreProps) {
  const handleTabChange = (value: string) => {
    if (value === "myWork") return;
    onTabChange?.(value);
  };

  return (
    <div className="h-full flex flex-col bg-transparent pt-[8px] pb-[3px]">
      <div
        className={cn(
          "sticky top-0 z-10 bg-transparent flex min-w-0 w-full max-w-full overflow-x-hidden",
          "flex-col items-stretch gap-2 md:gap-2.5 lg:flex-row lg:items-start lg:justify-start lg:gap-3",
          "px-[10px] max-sm:px-0 max-pane:px-2 max-pane:gap-1"
        )}
      >
        <div className="flex w-full min-w-0 flex-1 flex-col gap-1 lg:min-w-0">
          <Tabs value="myWork" onValueChange={handleTabChange} className="w-full">
            <div
              className={cn(
                taskToolbarRecessedClass,
                "min-w-0 max-w-[417px] max-sm:max-w-none w-max self-start max-sm:w-full max-sm:self-auto"
              )}
            >
              <TabsList
                className={cn(
                  "h-12 min-w-0 p-0 pt-[6px] pb-1.5 px-2 rounded-none bg-transparent",
                  "flex flex-nowrap items-center justify-start gap-x-1.5 overflow-x-auto max-sm:w-full max-sm:justify-between max-sm:gap-1"
                )}
              >
                <TabsTrigger
                  value="myWork"
                  title="My Work"
                  className={cn(taskTabShell, taskTabPadLabeled)}
                >
                  <span className="inline-flex max-w-full items-center justify-center min-w-0">
                    <AnimatedIcon
                      icon={CheckSquare}
                      size={16}
                      animateOnHover
                      animation="default"
                      className="shrink-0 h-4 w-4 mr-1 max-pane:mr-0.5 text-[rgb(20,184,166)]"
                    />
                    <span className="max-sm:truncate">My Work</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="records"
                  title="Records"
                  className={cn(taskTabShell, taskTabPadLabeled)}
                >
                  <span className="inline-flex max-w-full items-center justify-center min-w-0">
                    <ShieldCheck className="shrink-0 h-4 w-4 mr-1 max-pane:mr-0.5" />
                    <span className="max-sm:truncate">Records</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="schedule"
                  title="Schedule"
                  className={cn(taskTabShell, taskTabPadLabeled)}
                >
                  <span className="inline-flex max-w-full items-center justify-center min-w-0">
                    <AnimatedIcon
                      icon={Calendar}
                      size={16}
                      animateOnHover
                      animation="pointing"
                      className="shrink-0 h-4 w-4 mr-1 max-pane:mr-0.5"
                    />
                    <span className="max-sm:truncate">Schedule</span>
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {onOpenIntake ? (
          <div className="hidden min-w-0 layout:hidden sm:block lg:w-[255px] lg:shrink-0 lg:self-start lg:h-12 lg:min-h-12">
            <div className={cn("w-full min-w-0 lg:h-12 lg:min-h-12", taskToolbarRecessedClass)}>
              <div
                className={cn(
                  "grid h-12 min-h-12 w-full grid-cols-2 items-stretch gap-x-1.5 px-2 pt-[6px] pb-1.5",
                  "lg:h-12 lg:min-h-12 lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-1.5 lg:px-2 lg:py-1.5",
                  "max-pane:px-1"
                )}
              >
                <IntakeActionButtonPair
                  variant="toolbar"
                  layout="grid"
                  onAddRecord={() => onOpenIntake("add_record")}
                  onReportIssue={() => onOpenIntake("report_issue")}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden h-[515px] shrink-0">
        <MyWorkPanel {...myWorkProps} onOpenIntake={onOpenIntake} onTabChange={onTabChange} />
      </div>
    </div>
  );
}
