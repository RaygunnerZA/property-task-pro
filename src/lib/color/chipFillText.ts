/**
 * Chip fill → label contrast. Translucent washes must be composited onto the
 * surface behind the chip before judging light vs dark text.
 */

export type Rgba = { r: number; g: number; b: number; a: number };
export type Rgb = { r: number; g: number; b: number };

/** YIQ cutoff: below → white text. Filla area/chip fills are mostly light
 *  teals and sands; 150 keeps white text for coral and deep basement only. */
export const CHIP_TEXT_YIQ_CUTOFF = 150;

export function parseCssRgb(color: string): Rgba | null {
  const m = color.match(
    /rgba?\(\s*([\d.]+)[,\s/]+([\d.]+)[,\s/]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i
  );
  if (!m) return null;
  let a = 1;
  if (m[4] != null) {
    const raw = m[4];
    a = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    if (a > 1) a = a / 255;
  }
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
}

export function compositeOver(fg: Rgba, bg: Rgb): Rgb {
  const a = Math.min(1, Math.max(0, fg.a));
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

export function yiq({ r, g, b }: Rgb): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function shouldUseLightChipText(fill: Rgba, backdrop: Rgb): boolean {
  const perceived = fill.a >= 0.95 ? fill : compositeOver(fill, backdrop);
  return yiq(perceived) < CHIP_TEXT_YIQ_CUTOFF;
}
