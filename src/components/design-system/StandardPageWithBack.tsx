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
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showBottomNav?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
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
 *   backTo="/properties"
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
  children,
  maxWidth = "md",
  showBottomNav = true,
  className,
  headerClassName,
  contentClassName
}: StandardPageWithBackProps) {
  const navigate = useNavigate();
  
  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-7xl",
    lg: "max-w-7xl",
    xl: "max-w-7xl",
    full: "max-w-full"
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn("min-h-screen bg-background pb-20", className)}>
      <PageHeader className={headerClassName}>
        <div className={cn("mx-auto px-4 py-4 flex items-center justify-between", maxWidthClasses[maxWidth])}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {icon && <span className="icon-primary shrink-0">{icon}</span>}
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-foreground truncate">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
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

