import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import { WorkspaceScopeStrip } from "@/components/property-workspace";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

interface StandardPageWithBackProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  /** @deprecated Back now lives in the gradient header (activity variant); kept for call-site compat. */
  hideHeaderBack?: boolean;
  /** Row directly under the gradient strip, left-aligned (matches workbench scope bar). */
  belowGradientRow?: ReactNode;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showBottomNav?: boolean;
  className?: string;
  /** @deprecated No longer applied — header chrome is shared; kept for call-site compat. */
  headerClassName?: string;
  contentClassName?: string;
  /** Property-style accent for the shared gradient header. */
  headerAccentColor?: string;
  /** Omit in-content title when the page renders its own heading. */
  hideTitleInHeader?: boolean;
  /** Hide gradient-header search (centre-column search on activity areas). */
  hideHeaderSearch?: boolean;
}

/**
 * StandardPageWithBack - StandardPage variant with back button
 *
 * Secondary-screen chrome: [< Back] replaces the logo in the gradient header
 * (property selector to its right); title lives in the main column.
 */
export function StandardPageWithBack({
  title,
  subtitle,
  icon,
  action,
  backTo,
  onBack,
  hideHeaderBack = false,
  belowGradientRow,
  children,
  maxWidth = "md",
  showBottomNav = false,
  className,
  contentClassName,
  headerAccentColor,
  hideTitleInHeader = false,
  hideHeaderSearch = false,
}: StandardPageWithBackProps) {
  const navigate = useNavigate();
  const accent = headerAccentColor?.trim() || FILLA_TURQUOISE;

  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate(backTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const showTitle = !hideTitleInHeader;

  return (
    <div
      className={cn(
        "dashboard-workbench min-h-screen bg-background",
        showBottomNav ? "pb-20" : "pb-6",
        belowGradientRow != null && "property-workbench-scope-header",
        className
      )}
    >
      <GlobalAppHeader
        accentColor={accent}
        hideSearch
        variant="activity"
        onBack={handleBack}
      />

      {belowGradientRow != null && (
        <WorkspaceScopeStrip containerMaxWidthClass={maxWidthClasses[maxWidth]}>
          {belowGradientRow}
        </WorkspaceScopeStrip>
      )}

      <div className={cn("mx-auto px-gutter-page py-6", maxWidthClasses[maxWidth], contentClassName)}>
        {showTitle ? (
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
