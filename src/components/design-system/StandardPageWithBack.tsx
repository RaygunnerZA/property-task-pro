import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface StandardPageWithBackProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  /** Hide the header “Back” control (e.g. when using property scope row below). */
  hideHeaderBack?: boolean;
  /** Row directly under the gradient strip, left-aligned (matches workbench scope bar). */
  belowGradientRow?: ReactNode;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showBottomNav?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  /** Property-style horizontal gradient + light header text (matches dashboard / workbench). */
  headerAccentColor?: string;
}

/**
 * StandardPageWithBack - StandardPage variant with back button
 * 
 * For detail pages that need a back button in the header.
 * 
 * @example
 * ```tsx
 * <StandardPageWithBack
 *   title="Property Details"
 *   subtitle="123 Main St"
 *   backTo="/"
 *   icon={<Building2 className="h-6 w-6" />}
 * >
 *   <PropertyContent />
 * </StandardPageWithBack>
 * ```
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
  headerClassName,
  contentClassName,
  headerAccentColor,
}: StandardPageWithBackProps) {
  const navigate = useNavigate();
  const accent = headerAccentColor?.trim();
  
  const maxWidthClasses = {
    sm: "max-w-md",        // Mobile-first, single column
    md: "max-w-4xl",       // Tablet, comfortable reading width
    lg: "max-w-6xl",       // Desktop, two-column layouts
    xl: "max-w-7xl",       // Large desktop, multi-column
    full: "max-w-full"     // Full width, no constraints
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
    // Direct landings or empty stack: avoid no-op / leaving the app unexpectedly
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const headerBarStyle = accent
    ? {
        backgroundImage: `linear-gradient(90deg, ${accent} 0%, ${accent} 28%, transparent 97%, transparent 100%)`,
      }
    : undefined;

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        showBottomNav ? "pb-20" : "pb-6",
        /* Gradient + scope strip (~100px + ~48px) for workspace sticky columns */
        belowGradientRow != null && "property-workbench-scope-header",
        className
      )}
    >
      <PageHeader
        className={cn(accent && "!bg-transparent shadow-none border-0", headerClassName)}
        toolbarSurface={accent ? "gradient" : "plain"}
      >
        <div
          className={cn(
            "mx-auto flex h-[100px] min-h-[100px] items-center justify-between rounded-bl-[12px] px-gutter-page pr-24 sm:pr-36",
            maxWidthClasses[maxWidth]
          )}
          style={headerBarStyle}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {!hideHeaderBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className={cn(
                  "shrink-0",
                  accent && "text-white hover:bg-white/15 hover:text-white"
                )}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {icon && (
                <span
                  className={cn("shrink-0", accent ? "text-white [&_svg]:text-white" : "icon-primary")}
                >
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                <h1
                  className={cn(
                    "text-2xl font-semibold leading-tight truncate heading-l",
                    accent ? "text-white" : "text-foreground"
                  )}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p
                    className={cn(
                      "text-sm mt-1 truncate",
                      accent ? "text-white/85" : "text-muted-foreground"
                    )}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
          {action && (
            <div className={cn("flex shrink-0 items-center gap-2", accent && "[&_button]:text-white [&_button]:border-white/30")}>
              {action}
            </div>
          )}
        </div>
      </PageHeader>

      {belowGradientRow != null && (
        <div className="w-full border-b border-border/20 bg-background/80 shadow-sm backdrop-blur-sm">
          <div className={cn("mx-auto flex min-w-0 justify-start px-gutter-page py-2", maxWidthClasses[maxWidth])}>
            {belowGradientRow}
          </div>
        </div>
      )}

      <div className={cn("mx-auto px-gutter-page py-6", maxWidthClasses[maxWidth], contentClassName)}>
        {children}
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}

