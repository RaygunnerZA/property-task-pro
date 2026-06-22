import type { CSSProperties } from "react";

/** Layer paper grain over a solid fill (same noise as page background). */
export function paperTexturedColorStyle(fillColor: string): CSSProperties {
  return {
    backgroundImage: `var(--paper-texture), linear-gradient(${fillColor}, ${fillColor})`,
    backgroundSize: "100%, 100%",
    backgroundBlendMode: "multiply, normal",
  };
}

/** Layer paper grain over a horizontal fade gradient (workbench header strip). */
export function paperTexturedGradientHeaderStyle(color: string): CSSProperties {
  return {
    backgroundColor: color,
    backgroundImage: `var(--paper-texture), linear-gradient(90deg, ${color} 0%, ${color} 33%, transparent 100%)`,
    backgroundSize: "100%, 100%",
    backgroundBlendMode: "multiply, normal",
  };
}

/** Subtle grain on neutral chip surfaces (icon picker tiles). */
export function paperTexturedChipStyle(baseColor: string): CSSProperties {
  return {
    backgroundColor: baseColor,
    backgroundImage: "var(--paper-texture)",
    backgroundSize: "100%",
    backgroundBlendMode: "multiply",
  };
}
