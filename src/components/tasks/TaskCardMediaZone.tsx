import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isTaskSpaceIllustrationUrl } from "@/lib/taskIllustration";

const PAPER_TEXTURE_STYLE: CSSProperties = {
  backgroundImage: "var(--paper-texture)",
  backgroundColor: "rgba(0, 0, 0, 0)",
};

const UPLOADED_INSET_SHADOW_HORIZONTAL =
  "inset 2px 2px 2px 0px rgba(255, 255, 255, 0.71), inset -1px -1px 2px 0px rgba(0, 0, 0, 0.1), 3px 0px 6px 0px rgba(0, 0, 0, 0.15)";

const UPLOADED_INSET_SHADOW_VERTICAL =
  "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 0px 3px 6px rgba(0, 0, 0, 0.15)";

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
      : "w-full h-[140px] relative flex-shrink-0 overflow-hidden";

  if (!imageUrl) {
    return (
      <div className={cn(baseZoneClass, className)}>
        <div
          className={cn(
            "absolute inset-0 bg-muted/30 flex items-center justify-center",
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
        isIllustration && "flex items-center justify-center",
        className
      )}
      style={isIllustration ? PAPER_TEXTURE_STYLE : undefined}
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
            parent.classList.add("bg-muted");
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
