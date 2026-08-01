import { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { MobilePageTitleBar } from "@/components/design-system/MobilePageTitleBar";
import { createGradientHeaderStyle } from "@/components/layout/WorkbenchGradientHeader";
import { useThemeColor } from "@/hooks/useThemeColor";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
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
  /**
   * Gradient strip colour. Defaults to Filla turquoise for org/global screens.
   * Pass a property colour only on property-scoped pages.
   */
  headerAccentColor?: string;
}

/**
 * StandardPage - A standardized page layout component
 *
 * Provides consistent structure across all pages:
 * - Gradient header strip (Filla turquoise by default)
 * - Consistent max-width containers
 * - Optional bottom navigation
 */
export function StandardPage({
  title,
  subtitle,
  icon,
  action,
  children,
  maxWidth = "md",
  showBottomNav = false,
  className,
  headerClassName,
  contentClassName,
  headerAccentColor,
}: StandardPageProps) {
  const accent = headerAccentColor?.trim() || FILLA_TURQUOISE;
  const headerStyle = createGradientHeaderStyle(accent);
  useThemeColor(accent);

  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        showBottomNav ? "pb-20" : "pb-6",
        className,
      )}
    >
      <PageHeader
        className={cn("hidden lg:block !bg-transparent shadow-none border-0", headerClassName)}
        toolbarSurface="gradient"
        accentColor={accent}
      >
        <div
          className={cn(
            "mx-auto flex h-[60px] min-h-[60px] items-center justify-between rounded-bl-xl px-gutter-page pr-24 sm:pr-32",
            maxWidthClasses[maxWidth],
          )}
          style={headerStyle}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="shrink-0 text-white [&_svg]:text-white">{icon}</span>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold leading-tight text-white heading-l">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-white/85">{subtitle}</p>
              )}
            </div>
          </div>
          {action && (
            <div className="flex shrink-0 items-center gap-2 [&_button]:border-white/30 [&_button]:text-white">
              {action}
            </div>
          )}
        </div>
      </PageHeader>

      <MobilePageTitleBar title={title} subtitle={subtitle} icon={icon} action={action} />

      <div className={cn("mx-auto px-gutter-page py-8", maxWidthClasses[maxWidth], contentClassName)}>
        {children}
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
