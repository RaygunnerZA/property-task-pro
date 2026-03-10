import { cn } from "@/lib/utils";

interface RadialProgressProps {
  value: number;
  size?: number;
  thickness?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Fat radial progress dial with rounded ends.
 * Uses SVG stroke for smooth rounded caps.
 */
export function RadialProgress({
  value,
  size = 112,
  thickness = 20,
  className,
  "aria-label": ariaLabel,
}: RadialProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const innerR = radius - thickness / 2;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        boxShadow: "inset 2px 3px 3px 0px rgba(0, 0, 0, 0.23), inset -1.6px -4px 5.4px 0px rgba(255, 255, 255, 1)",
      }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ filter: "drop-shadow(0px 2px 6px rgba(142,201,206,0.45))" }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-muted/90"
        />
        {/* Progress arc with rounded ends */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary transition-[stroke-dashoffset] duration-500 ease-out"
          style={{ color: "rgba(133, 186, 188, 0.96)" }}
        />
        {/* Inner edge overlay — shadow falls outward over the ring from the centre hole */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerR}
          fill="hsl(var(--background))"
          stroke="none"
          style={{ filter: "drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.28))" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono"
        style={{ fontSize: Math.round(size * 0.179), color: "rgba(133, 186, 188, 1)" }}
      >
        {Math.round(clampedValue)}%
      </span>
    </div>
  );
}
