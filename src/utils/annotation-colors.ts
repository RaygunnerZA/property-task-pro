import type { AnnotationColor, AnnotationStrokeWidth } from "@/types/image-annotations";

export const ANNOTATION_COLORS: Record<AnnotationColor, string> = {
  "charcoal": "#2C2C2C",
  "white": "#FFFFFF",
  "warning-orange": "#F97316",
  "danger-red": "#EF4444",
  "calm-blue": "#3B82F6",
  "success-green": "#10B981",
};

export const STROKE_WIDTHS: Record<AnnotationStrokeWidth, number> = {
  "thin": 1,
  "medium": 2,
  "bold": 3,
};

export function getColorHex(color: AnnotationColor): string {
  return ANNOTATION_COLORS[color];
}

export function getStrokeWidthPx(width: AnnotationStrokeWidth): number {
  return STROKE_WIDTHS[width];
}
