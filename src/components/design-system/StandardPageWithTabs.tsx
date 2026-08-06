import { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
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
  children?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showBottomNav?: boolean;
  className?: string;
  /** @deprecated No longer applied — header chrome is shared; kept for call-site compat. */
  headerClassName?: string;
  contentClassName?: string;
  headerAccentColor?: string;
}

/**
 * StandardPageWithTabs - StandardPage variant with tab navigation
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
  contentClassName,
  headerAccentColor,
}: StandardPageWithTabsProps) {
  const accent = headerAccentColor?.trim() || FILLA_TURQUOISE;

  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-7xl",
    lg: "max-w-7xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  const defaultTabValue = defaultTab || tabs[0]?.value || "";

  return (
    <div
      className={cn(
        "dashboard-workbench min-h-screen bg-background",
        showBottomNav ? "pb-20" : "pb-6",
        className
      )}
    >
      <GlobalAppHeader accentColor={accent} />

      <div className={cn("mx-auto px-gutter-page py-6", maxWidthClasses[maxWidth], contentClassName)}>
        <PageContentTitle
          title={title}
          subtitle={subtitle}
          icon={icon}
          action={action}
        />

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
