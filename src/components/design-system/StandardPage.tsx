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
    sm: "max-w-md",
    md: "max-w-7xl",
    lg: "max-w-7xl",
    xl: "max-w-7xl",
    full: "max-w-full"
  };

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
        {children}
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}

