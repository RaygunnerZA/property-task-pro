import { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

interface StandardPageProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showBottomNav?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

/**
 * StandardPage - A standardized page layout component
 * 
 * Provides consistent structure across all pages:
 * - Standardized header with title, subtitle, icon, and action
 * - Consistent max-width containers
 * - Optional bottom navigation
 * - Design system compliant styling
 * 
 * @example
 * ```tsx
 * <StandardPage
 *   title="Tasks"
 *   subtitle="5 active tasks"
 *   icon={<ListTodo className="h-6 w-6" />}
 *   action={<NeomorphicButton>Add Task</NeomorphicButton>}
 * >
 *   <TaskList />
 * </StandardPage>
 * ```
 */
export function StandardPage({
  title,
  subtitle,
  icon,
  action,
  children,
  maxWidth = "md",
  showBottomNav = true,
  className,
  headerClassName,
  contentClassName
}: StandardPageProps) {
  const maxWidthClasses = {
    sm: "max-w-md",        // Mobile-first, single column
    md: "max-w-4xl",       // Tablet, comfortable reading width
    lg: "max-w-6xl",       // Desktop, two-column layouts
    xl: "max-w-7xl",       // Large desktop, multi-column
    full: "max-w-full"     // Full width, no constraints
  };

  return (
    <div className={cn("min-h-screen bg-background pb-20", className)}>
      <PageHeader className={headerClassName}>
        <div className={cn("mx-auto px-4 pt-[63px] pb-[21px] h-[100px] flex items-center justify-between rounded-bl-[12px]", maxWidthClasses[maxWidth])}>
          <div className="flex items-center gap-3">
            {icon && <span className="icon-primary shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-foreground leading-tight heading-l">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </PageHeader>

      <div className={cn("mx-auto px-4 py-6", maxWidthClasses[maxWidth], contentClassName)}>
        {children}
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}

