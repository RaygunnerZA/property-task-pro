import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isTaskSpaceIllustrationUrl } from "@/lib/taskIllustration";

const UPLOADED_INSET_SHADOW_HORIZONTAL =
  // No right-edge cast/inset — that reads as a hard seam against the card body.
  // Depth stays on the top/left (and a soft bottom), so the right can fade out.
  "inset 2px 2px 2px 0px rgba(255, 255, 255, 0.71), inset 0px -1px 2px 0px rgba(0, 0, 0, 0.08)";

const UPLOADED_INSET_SHADOW_VERTICAL =
  "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 0px 3px 6px rgba(0, 0, 0, 0.15)";

/** Vertical illustrated task cards — shared inset highlight (Open work slider, property task strips). */
export const VERTICAL_ILLUSTRATION_INSET_SHADOW_CLASS =
  "shadow-[inset_1px_2px_1px_0px_rgba(255,255,255,0.5)]";

const HORIZONTAL_ILLUSTRATION_INSET_SHADOW_CLASS =
  "shadow-[inset_0px_1px_1px_0px_rgba(255,255,255,0.7)]";

interface TaskCardMediaZoneProps {
  imageUrl?: string | null;
  alt: string;
  variant: "horizontal" | "vertical";
  /** Force a fixed square media frame (Messages tab cards). */
  fixedSize?: number;
  className?: string;
  placeholderClassName?: string;
  /** Dim thumbnail media (e.g. completed / on hold) — overlays stay full opacity. */
  dimmed?: boolean;
  children?: ReactNode;
}

export function TaskCardMediaZone({
  imageUrl,
  alt,
  variant,
  fixedSize,
  className,
  placeholderClassName,
  dimmed = false,
  children,
}: TaskCardMediaZoneProps) {
  const isIllustration = isTaskSpaceIllustrationUrl(imageUrl);
  const baseZoneClass = fixedSize
    ? "relative shrink-0 overflow-hidden"
    : variant === "horizontal"
      ? "w-24 sm:w-28 flex-shrink-0 relative overflow-hidden"
      : "w-full h-[140px] relative flex-shrink-0 overflow-hidden pt-0 rounded-t-xl";

  const fixedStyle =
    fixedSize != null
      ? { width: fixedSize, height: fixedSize, minWidth: fixedSize, minHeight: fixedSize }
      : undefined;

  const verticalIllustrationZoneClass =
    variant === "vertical" &&
    !fixedSize &&
    cn("flex items-center justify-center bg-transparent", VERTICAL_ILLUSTRATION_INSET_SHADOW_CLASS);

  if (!imageUrl) {
    return (
      <div
        className={cn(baseZoneClass, verticalIllustrationZoneClass, className)}
        style={fixedStyle}
      >
        <div
          className={cn(
            "absolute inset-0 bg-transparent flex items-center justify-center",
            dimmed && "opacity-50",
            placeholderClassName
          )}
        >
          <div
            className={cn(
              "rounded bg-muted/50",
              fixedSize ? "h-8 w-8" : variant === "horizontal" ? "w-8 h-8" : "w-12 h-12"
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
        isIllustration && "flex items-center justify-center bg-transparent",
        isIllustration &&
          variant === "horizontal" &&
          HORIZONTAL_ILLUSTRATION_INSET_SHADOW_CLASS,
        isIllustration && variant === "vertical" && !fixedSize && VERTICAL_ILLUSTRATION_INSET_SHADOW_CLASS,
        className
      )}
      style={fixedStyle}
    >
      <img
        src={imageUrl}
        alt={alt}
        className={cn(
          isIllustration
            ? "max-h-full max-w-full object-contain p-2"
            : "absolute inset-0 h-full w-full object-cover",
          dimmed && "opacity-50"
        )}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent && !isIllustration) {
            parent.classList.add("bg-transparent");
          }
        }}
      />
      {/*
        User photos: fade into the card surface. One masked strip carries the
        same fill + paper noise as bg-card/60, so the grain continues through
        the blend instead of sitting as a separate wash.
      */}
      {!isIllustration && (variant === "horizontal" || fixedSize != null) ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-5 overflow-hidden"
          style={{
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 100%)",
            maskImage: "linear-gradient(to right, transparent 0%, black 100%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor:
                "color-mix(in srgb, hsl(var(--card)) 60%, hsl(var(--background)) 40%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "var(--paper-texture)",
              backgroundSize: "100%",
              opacity: 0.3,
            }}
          />
        </div>
      ) : null}
      {!isIllustration ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
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
