import type { AnnotationColor, AnnotationLineStyle, AnnotationStrokeWidth } from "@/types/image-annotations";

export const ANNOTATION_COLORS: Record<AnnotationColor, string> = {
  "charcoal": "#2C2C2C",
  "white": "#FFFFFF",
  "warning-orange": "#F97316",
  "danger-red": "#EF4444",
  "calm-blue": "#3B82F6",
  "success-green": "#10B981",
};

export const STROKE_WIDTHS: Record<AnnotationStrokeWidth, number> = {
  "thin": 2,
  "medium": 4,
  "bold": 6,
};

export const TEXT_SIZE_PTS = [12, 14, 18, 24, 32] as const;
export const DEFAULT_FONT_SIZE_PT = 16;
export const SELECTION_TEAL = "#8EC9CE";

export function getColorHex(color: AnnotationColor): string {
  return ANNOTATION_COLORS[color];
}

export function getStrokeWidthPx(width: AnnotationStrokeWidth): number {
  return STROKE_WIDTHS[width];
}

export function getLineDash(
  style: AnnotationLineStyle | undefined,
  strokePx: number,
): number[] {
  if (style !== "dashed") return [];
  return [strokePx * 2.5, strokePx * 1.75];
}

export function getTextHighlightFill(textColor: AnnotationColor): string {
  return textColor === "white" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)";
}

export function getFontSizePx(fontSizePt: number | undefined, imageWidth: number): number {
  const pt = fontSizePt ?? DEFAULT_FONT_SIZE_PT;
  const scale = imageWidth / 720;
  return Math.max(11, pt * Math.max(0.8, Math.min(1.5, scale)));
}
