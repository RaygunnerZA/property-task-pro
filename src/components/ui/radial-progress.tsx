import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

interface RadialProgressProps {
  value: number;
  size?: number;
  thickness?: number;
  /** Inner paper disc diameter; defaults relative to size when omitted. */
  innerDiscSize?: number;
  /**
   * @deprecated Kept for call-site compatibility — labels are geometrically centered;
   * this no longer shifts the dial.
   */
  labelMarginLeft?: number;
  /** Transparent outer surface (e.g. sidebar briefing) — no filled disc behind the ring */
  embed?: boolean;
  /** Soft = offset-debossed property summary; default = fuller briefing / hub treatment. */
  visualWeight?: "default" | "soft";
  className?: string;
  "aria-label"?: string;
}

/** Shared absolute centering — every ring/disc/label uses this so geometry stays concentric. */
const CENTERED: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
};

/**
 * Offset deboss (pressed into the surface): dark inset from top-left, light inset from bottom-right.
 * Matches Filla `text-shadow-neu-pressed` light direction.
 */
const DEBOSS_INNER_SOFT =
  "inset 2px 3px 5px 0px rgba(0, 0, 0, 0.12), inset -2px -2px 4px 0px rgba(255, 255, 255, 0.78)";
const DEBOSS_WELL_SOFT =
  "inset 2px 3px 6px 0px rgba(0, 0, 0, 0.10), inset -2px -2px 5px 0px rgba(255, 255, 255, 0.72)";
const DEBOSS_INNER_DEFAULT =
  "inset 2px 4px 7px 0px rgba(0, 0, 0, 0.14), inset -2px -3px 5px 0px rgba(255, 255, 255, 0.7)";
const DEBOSS_WELL_DEFAULT =
  "inset 2px 4px 8px 0px rgba(0, 0, 0, 0.12), inset -2px -3px 6px 0px rgba(255, 255, 255, 0.65)";

/** Outer emboss ring: highlight top/left + shadow bottom/right (sits behind all dial layers). */
const OUTER_RING_OFFSET_PX = 7;
const EMBOSSED_OUTER_SOFT =
  "-2px -2px 4px 0px rgba(255, 255, 255, 0.88), 2px 3px 5px 0px rgba(0, 0, 0, 0.10)";
const EMBOSSED_OUTER_DEFAULT =
  "-3px -3px 5px 0px rgba(255, 255, 255, 0.9), 3px 4px 6px 0px rgba(0, 0, 0, 0.12)";

/** Card-tinted fill with softened paper grain — halfway between full background noise and washed white. */
const OUTER_RING_SURFACE: CSSProperties = {
  backgroundColor: "hsl(var(--background))",
  backgroundImage:
    "linear-gradient(hsl(var(--card) / 0.4), hsl(var(--card) / 0.4)), var(--paper-texture)",
  backgroundSize: "100%",
};

/**
 * Neumorphic radial completion gauge.
 * Soft weight: concentric rings with offset debossing on the well + inner disc.
 */
export function RadialProgress({
  value,
  size = 112,
  thickness = 20,
  innerDiscSize: innerDiscSizeProp,
  embed = false,
  visualWeight = "default",
  className,
  "aria-label": ariaLabel,
}: RadialProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const softVisual = visualWeight === "soft";
  const displayValue = useCountUp(clampedValue, 900);

  const outerRingSize = size + OUTER_RING_OFFSET_PX * 2;
  /** Room for the outer ring and its cast shadows so they are not clipped. */
  const framePad = OUTER_RING_OFFSET_PX + (softVisual ? 6 : 5);
  const frame = size + framePad * 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - displayValue / 100);
  const innerDiscSize = innerDiscSizeProp ?? Math.round(size * (softVisual ? 0.7 : 0.72));
  const cx = size / 2;

  const compactEmbedLabel = embed && size < 90;
  const softSummaryLabel = softVisual && size >= 96;
  const labelNumberFontSize = softSummaryLabel ? 34 : compactEmbedLabel ? 32 : 45;
  const labelPercentFontSize = softSummaryLabel ? 15 : compactEmbedLabel ? 14 : 16;

  const rootSurfaceStyle = embed
    ? {
        background: "unset" as const,
        backgroundImage: "none" as const,
        backgroundColor: "unset" as const,
        border: "none",
        borderStyle: "none" as const,
        borderColor: "transparent",
        borderImage: "none" as const,
      }
    : {};

  return (
    <div
      className={cn("relative isolate", className)}
      style={{
        width: frame,
        height: frame,
        ...rootSurfaceStyle,
      }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      {/* Largest embossed outer ring — behind every other layer (+7px each side) */}
      <div
        aria-hidden
        style={{
          ...CENTERED,
          zIndex: 0,
          width: outerRingSize,
          height: outerRingSize,
          borderRadius: "50%",
          ...OUTER_RING_SURFACE,
          pointerEvents: "none",
          boxShadow: softVisual ? EMBOSSED_OUTER_SOFT : EMBOSSED_OUTER_DEFAULT,
        }}
      />

      {/* Non-embed base fill under the dial well */}
      {!embed ? (
        <div
          aria-hidden
          style={{
            ...CENTERED,
            zIndex: 1,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "hsl(var(--background))",
            backgroundImage: "var(--paper-texture)",
            backgroundSize: "100%",
          }}
        />
      ) : null}

      {/* Outer well — offset debossed ring bed */}
      <div
        aria-hidden
        style={{
          ...CENTERED,
          zIndex: 2,
          width: size,
          height: size,
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: softVisual ? DEBOSS_WELL_SOFT : DEBOSS_WELL_DEFAULT,
        }}
      />

      {/* Track + progress — centered; rotate around geometric center only */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          ...CENTERED,
          zIndex: 3,
          transform: "translate(-50%, -50%) rotate(-90deg)",
          overflow: "visible",
        }}
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={softVisual ? "rgba(194, 220, 222, 0.5)" : "rgba(194, 220, 222, 0.85)"}
          strokeWidth={thickness}
        />
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke="rgba(142, 201, 206, 0.95)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          opacity={clampedValue === 0 ? 0 : 1}
        />
      </svg>

      {/* Inner disc — offset debossed (sunken), not raised */}
      <div
        aria-hidden
        style={{
          ...CENTERED,
          zIndex: 4,
          width: innerDiscSize,
          height: innerDiscSize,
          borderRadius: "50%",
          background: "hsl(var(--background))",
          backgroundImage: "var(--paper-texture)",
          backgroundSize: "100%",
          pointerEvents: "none",
          boxShadow: softVisual ? DEBOSS_INNER_SOFT : DEBOSS_INNER_DEFAULT,
        }}
      />

      {/* Percentage — geometrically + optically centered in the inner disc */}
      <span
        className={cn(!softVisual && "text-shadow-neu-pressed")}
        style={{
          ...CENTERED,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter Tight', system-ui, -apple-system, sans-serif",
          letterSpacing: softSummaryLabel ? "-0.8px" : "-0.9px",
          lineHeight: 1,
          userSelect: "none",
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
          textShadow: softVisual
            ? "-1px -1px 1px rgba(0,0,0,0.12), 1px 1px 1px rgba(255,255,255,0.45)"
            : undefined,
        }}
      >
        <span
          style={{
            fontSize: labelNumberFontSize,
            fontWeight: softVisual ? 400 : 300,
            color: softVisual ? "rgba(82, 82, 90, 1)" : "rgba(102, 102, 102, 1)",
            lineHeight: 1,
          }}
        >
          {Math.round(displayValue)}
        </span>
        <span
          style={{
            fontSize: labelPercentFontSize,
            fontWeight: 700,
            lineHeight: 1,
            color: "rgba(142, 201, 206, 1)",
            transform: "translateY(-0.08em)",
          }}
        >
          %
        </span>
      </span>
    </div>
  );
}
