import type { CSSProperties } from "react";

/** Layer paper grain over a solid fill (same noise as page background). */
export function paperTexturedColorStyle(fillColor: string): CSSProperties {
  return {
    backgroundImage: `var(--paper-texture), linear-gradient(${fillColor}, ${fillColor})`,
    backgroundSize: "100%, 100%",
    backgroundBlendMode: "multiply, normal",
  };
}

/** Layer paper grain over a horizontal fade gradient (workbench header strip).
 * Colour is full opacity on the left and fades to transparent on the right so the
 * page paper/noise shows through — seamless with the surface below.
 */
export function paperTexturedGradientHeaderStyle(color: string): CSSProperties {
  return {
    backgroundColor: "transparent",
    backgroundImage: [
      `linear-gradient(90deg, ${color} 0%, ${color} 33%, transparent 100%)`,
      "var(--paper-texture)",
    ].join(", "),
    backgroundSize: "100%, 100%",
    backgroundRepeat: "no-repeat, repeat",
    backgroundBlendMode: "normal, multiply",
  };
}

/**
 * Diagonal wash: colour holds solid through ~15% from the top-left, then fades to
 * transparent by ~80% along the diagonal. Paper grain multiplies on top (same as solid
 * fills) so the card matches page noise; transparent end lets the paper surface show through.
 */
export function paperTexturedDiagonalFadeStyle(color: string): CSSProperties {
  return {
    backgroundColor: "transparent",
    backgroundImage: [
      "var(--paper-texture)",
      `linear-gradient(135deg, ${color} 0%, ${color} 15%, transparent 80%)`,
    ].join(", "),
    backgroundSize: "100%, 100%",
    backgroundRepeat: "repeat, no-repeat",
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
