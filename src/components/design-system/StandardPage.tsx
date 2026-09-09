import { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
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
  /** @deprecated No longer applied — header chrome is shared; kept for call-site compat. */
  headerClassName?: string;
  contentClassName?: string;
  /**
   * Gradient strip colour. Defaults to Filla turquoise for org/global screens.
   * Pass a property colour only on property-scoped pages.
   */
  headerAccentColor?: string;
  /** Omit in-content title when the page renders its own heading (e.g. left column). */
  hideTitle?: boolean;
  /**
   * Hide gradient-header search; use centre-column pressed search on activity areas.
   * Keep search in the header on Home only.
   */
  hideHeaderSearch?: boolean;
  /**
   * `activity`: secondary-screen header — no logo / no search,
   * [< Back] top-left with property selector to its right.
   */
  headerVariant?: "workbench" | "activity";
  /** Back handler for the activity header (defaults to history back). */
  onHeaderBack?: () => void;
}

/**
 * StandardPage - A standardized page layout component
 *
 * Provides consistent structure across all pages:
 * - Full-bleed logo + gradient header (same as workbench)
 * - Optional page title in the main content column (prefer left-column H1 via PropertyWorkspaceLayout)
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
  contentClassName,
  headerAccentColor,
  hideTitle = false,
  hideHeaderSearch = false,
  headerVariant = "workbench",
  onHeaderBack,
}: StandardPageProps) {
  const accent = headerAccentColor?.trim() || FILLA_TURQUOISE;

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
        "dashboard-workbench min-h-screen bg-background",
        showBottomNav ? "pb-20" : "pb-6",
        className,
      )}
    >
      <GlobalAppHeader
        accentColor={accent}
        hideSearch={hideHeaderSearch}
        variant={headerVariant}
        onBack={onHeaderBack}
      />

      <div className={cn("mx-auto px-gutter-page py-6 sm:py-8", maxWidthClasses[maxWidth], contentClassName)}>
        {!hideTitle ? (
          <PageContentTitle
            title={title}
            subtitle={subtitle}
            icon={icon}
            action={action}
          />
        ) : null}
        {children}
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
