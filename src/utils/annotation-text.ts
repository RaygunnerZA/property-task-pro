import type { TextAnnotation } from "@/types/image-annotations";
import { getFontSizePx } from "@/utils/annotation-colors";

export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const source = text.length > 0 ? text : " ";
  const explicit = source.split("\n");
  const lines: string[] = [];

  for (const paragraph of explicit) {
    const words = paragraph.split(" ");
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const testLine = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = testLine;
      }
    }
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

export function measureTextFrame(
  ctx: CanvasRenderingContext2D,
  annotation: TextAnnotation,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number; fontSize: number; lines: string[] } {
  const fontSize = getFontSizePx(annotation.fontSizePt, imageWidth);
  ctx.font = `${fontSize}px "Inter Tight", sans-serif`;
  const width = Math.max(24, annotation.width * imageWidth);
  const lines = wrapTextLines(ctx, annotation.text || "Text", width);
  const lineHeight = fontSize * 1.3;
  const contentHeight = Math.max(lineHeight, lines.length * lineHeight);
  const storedHeight = annotation.height ? annotation.height * imageHeight : 0;
  return {
    x: annotation.x * imageWidth,
    y: annotation.y * imageHeight,
    width,
    height: Math.max(contentHeight, storedHeight),
    fontSize,
    lines,
  };
}
