import { cn } from "@/lib/utils";

interface RadialProgressProps {
  value: number;
  size?: number;
  thickness?: number;
  className?: string;
  "aria-label"?: string;
}

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
  const offset = circumference * (1 - clampedValue / 100);
  const fontSize = Math.round(size * 0.167);
  const innerDiscSize = 63;

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size + 10, height: size + 10, display: "grid", placeItems: "center" }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      {/* Base disc */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "hsl(var(--background))",
          backgroundImage: "var(--paper-texture)",
          backgroundSize: "100%",
        }}
      />

      {/* Grey track ring */}
      <svg
        width={size + 10}
        height={size + 10}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", opacity: 1, paddingTop: 5, paddingBottom: 5 }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(194, 220, 222, 0.92)"
          strokeWidth={thickness}
          style={{ opacity: 0 }}
        />
      </svg>

      {/* Teal progress arc */}
      <svg
        width={size + 10}
        height={size + 10}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          transform: "rotate(-90deg)",
          filter: "drop-shadow(0px 2px 6px rgba(142,201,206,0.5))",
          opacity: 1,
          paddingTop: 5,
          paddingBottom: 5,
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(133,186,188,0.95)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 500ms ease-out",
            opacity: clampedValue === 0 ? 0 : 1,
          }}
        />
      </svg>

      {/* Outer rim highlight — top light, bottom shadow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: "inset -1px -2px 3.9px 0px rgba(255, 255, 255, 0.66), inset 1.2px 3.8px 7.6px 0px rgba(0, 0, 0, 0.15)",
          filter: "none",
        }}
      />

      {/* Inner paper disc to keep center texture */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: innerDiscSize,
          height: innerDiscSize,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "hsl(var(--background))",
          backgroundImage: "var(--paper-texture)",
          backgroundSize: "100%",
          pointerEvents: "none",
          boxShadow: "0px -1px 2px rgba(255,255,255,0.7), 0px 3px 6px rgba(0,0,0,0.12), inset 0px 1px 1px rgba(255,255,255,0.45)",
        }}
      />

      {/* Inner disc edge shaping */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: innerDiscSize,
          height: innerDiscSize,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: "0px -2px 4px 0px rgba(255, 255, 255, 0.5), 1.2px 3.8px 3.4px 0px rgba(0, 0, 0, 0.1)",
          opacity: 0.86,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      />

      {/* Radial gradient shading over the ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle, transparent ${Math.round((1 - thickness / size) * 52)}%, rgba(0,0,0,0.07) ${Math.round((1 - thickness / size) * 68)}%, transparent ${Math.round((1 - thickness / size) * 70)}%)`,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          opacity: 0.24,
        }}
      />

      {/* Percentage label — neumorphic pressed numerals */}
      <span
        className="text-shadow-neu-pressed"
        style={{
          position: "relative",
          fontSize: 30,
          fontWeight: 400,
          fontFamily: "'Inter Tight', system-ui, -apple-system, sans-serif",
          letterSpacing: "-0.9px",
          marginLeft: 8,
          marginRight: 2,
          color: "rgba(42, 41, 62, 1)",
          lineHeight: 1,
          userSelect: "none",
          fontVariantNumeric: "tabular-nums",
          display: "inline-flex",
          alignItems: "flex-start",
          gap: 1,
        }}
      >
        <span>{Math.round(clampedValue)}</span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.1,
            opacity: 0.95,
            transform: "translateY(1px)",
            marginLeft: 3,
            color: "rgba(255, 255, 255, 1)",
          }}
        >
          %
        </span>
      </span>
    </div>
  );
}
