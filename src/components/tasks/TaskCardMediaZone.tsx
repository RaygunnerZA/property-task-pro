import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isTaskSpaceIllustrationUrl } from "@/lib/taskIllustration";

const UPLOADED_INSET_SHADOW_HORIZONTAL =
  "inset 2px 2px 2px 0px rgba(255, 255, 255, 0.71), inset -1px -1px 2px 0px rgba(0, 0, 0, 0.1), 3px 0px 6px 0px rgba(0, 0, 0, 0.15)";

const UPLOADED_INSET_SHADOW_VERTICAL =
  "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 0px 3px 6px rgba(0, 0, 0, 0.15)";

/** Vertical illustrated task cards — shared inset highlight (Open work slider, property task strips). */
export const VERTICAL_ILLUSTRATION_INSET_SHADOW_CLASS =
  "shadow-[inset_1px_2px_1px_0px_rgba(255,255,255,0.5)]";

interface TaskCardMediaZoneProps {
  imageUrl?: string | null;
  alt: string;
  variant: "horizontal" | "vertical";
  className?: string;
  placeholderClassName?: string;
  children?: ReactNode;
}

export function TaskCardMediaZone({
  imageUrl,
  alt,
  variant,
  className,
  placeholderClassName,
  children,
}: TaskCardMediaZoneProps) {
  const isIllustration = isTaskSpaceIllustrationUrl(imageUrl);
  const baseZoneClass =
    variant === "horizontal"
      ? "w-24 sm:w-28 flex-shrink-0 relative overflow-hidden"
      : "w-full h-[140px] relative flex-shrink-0 overflow-hidden pt-0 rounded-t-[12px]";

  const verticalIllustrationZoneClass =
    variant === "vertical" &&
    cn("flex items-center justify-center bg-background", VERTICAL_ILLUSTRATION_INSET_SHADOW_CLASS);

  if (!imageUrl) {
    return (
      <div className={cn(baseZoneClass, verticalIllustrationZoneClass, className)}>
        <div
          className={cn(
            "absolute inset-0 bg-background flex items-center justify-center",
            placeholderClassName
          )}
        >
          <div
            className={cn(
              "rounded bg-muted/50",
              variant === "horizontal" ? "w-8 h-8" : "w-12 h-12"
            )}
          />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        baseZoneClass,
        isIllustration && "flex items-center justify-center bg-background",
        isIllustration && variant === "vertical" && VERTICAL_ILLUSTRATION_INSET_SHADOW_CLASS,
        className
      )}
    >
      <img
        src={imageUrl}
        alt={alt}
        className={cn(
          isIllustration
            ? "max-h-full max-w-full object-contain p-2"
            : "absolute inset-0 h-full w-full object-cover"
        )}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent && !isIllustration) {
            parent.classList.add("bg-background");
          }
        }}
      />
      {!isIllustration ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow:
              variant === "horizontal"
                ? UPLOADED_INSET_SHADOW_HORIZONTAL
                : UPLOADED_INSET_SHADOW_VERTICAL,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
