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

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
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
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-muted/40"
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
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono font-extrabold text-foreground"
        style={{ fontSize: size * 0.2 }}
      >
        {Math.round(clampedValue)}%
      </span>
    </div>
  );
}
