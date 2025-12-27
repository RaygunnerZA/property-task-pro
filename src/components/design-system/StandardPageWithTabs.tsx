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
  showBottomNav = true,
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
    <div className={cn("min-h-screen bg-background pb-20", className)}>
      <PageHeader className={headerClassName}>
        <div className={cn("mx-auto px-4 py-4 flex items-center justify-between", maxWidthClasses[maxWidth])}>
          <div className="flex items-center gap-2">
            {icon && <span className="icon-primary">{icon}</span>}
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      </PageHeader>

      <div className={cn("mx-auto px-4 py-6", maxWidthClasses[maxWidth], contentClassName)}>
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

