import { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface StandardPageWithTabsProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  tabs: TabItem[];
  defaultTab?: string;
  onTabChange?: (value: string) => void;
  children?: ReactNode; // Optional content outside tabs
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showBottomNav?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

/**
 * StandardPageWithTabs - StandardPage variant with tab navigation
 * 
 * For pages that need tabbed interfaces.
 * 
 * @example
 * ```tsx
 * <StandardPageWithTabs
 *   title="Property Details"
 *   icon={<Building2 className="h-6 w-6" />}
 *   tabs={[
 *     { value: "overview", label: "Overview", content: <OverviewTab /> },
 *     { value: "tasks", label: "Tasks", content: <TasksTab /> },
 *   ]}
 * />
 * ```
 */
export function StandardPageWithTabs({
  title,
  subtitle,
  icon,
  action,
  tabs,
  defaultTab,
  onTabChange,
  children,
  maxWidth = "md",
  showBottomNav = false,
  className,
  headerClassName,
  contentClassName
}: StandardPageWithTabsProps) {
  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-7xl",
    lg: "max-w-7xl",
    xl: "max-w-7xl",
    full: "max-w-full"
  };

  const defaultTabValue = defaultTab || tabs[0]?.value || "";

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        showBottomNav ? "pb-20" : "pb-6",
        className
      )}
    >
      <PageHeader className={headerClassName} toolbarSurface="plain">
        <div
          className={cn(
            "mx-auto flex h-[60px] min-h-[60px] items-center justify-between px-gutter-page py-2 pr-24 sm:pr-32",
            maxWidthClasses[maxWidth]
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon && <span className="icon-primary shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-foreground heading-l leading-tight">{title}</h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      </PageHeader>

      <div className={cn("mx-auto px-gutter-page py-6", maxWidthClasses[maxWidth], contentClassName)}>
        {children && <div className="mb-6">{children}</div>}
        
        <Tabs defaultValue={defaultTabValue} onValueChange={onTabChange} className="w-full">
          <TabsList className="mb-6">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}

