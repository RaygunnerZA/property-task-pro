const MAX_PDF_THUMB_BYTES = 12 * 1024 * 1024;
const THUMB_MAX_EDGE = 720;
const MAX_TEXT_CHARS = 8000;

export interface PdfInspection {
  thumbnailUrl: string | null;
  text: string;
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/**
 * Rasterise page 1 and read visible text. Dynamic import keeps pdf.js
 * out of the default bundle until a PDF is opened.
 */
export async function inspectPdf(data: ArrayBuffer): Promise<PdfInspection> {
  if (typeof document === "undefined") return { thumbnailUrl: null, text: "" };
  if (data.byteLength === 0 || data.byteLength > MAX_PDF_THUMB_BYTES) {
    return { thumbnailUrl: null, text: "" };
  }

  try {
    const pdfjs = await loadPdfjs();
    const copy = Uint8Array.from(new Uint8Array(data));
    const doc = await pdfjs.getDocument({
      data: copy,
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    try {
      const page = await doc.getPage(1);
      const [thumbnailUrl, text] = await Promise.all([
        renderPage(page),
        readPageText(page),
      ]);
      return { thumbnailUrl, text };
    } finally {
      await doc.destroy();
    }
  } catch {
    return { thumbnailUrl: null, text: "" };
  }
}

async function renderPage(page: {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
  };
}): Promise<string | null> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(THUMB_MAX_EDGE / base.width, THUMB_MAX_EDGE / base.height, 1.4);
  const viewport = page.getViewport({ scale: Math.max(scale, 0.6) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.76);
}

async function readPageText(page: {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
}): Promise<string> {
  try {
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, MAX_TEXT_CHARS);
  } catch {
    return "";
  }
}

/** @deprecated use inspectPdf — kept for call sites that only need a raster. */
export async function renderPdfPageThumbnail(data: ArrayBuffer): Promise<string | null> {
  const result = await inspectPdf(data);
  return result.thumbnailUrl;
}
