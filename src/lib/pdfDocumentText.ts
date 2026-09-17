/**
 * Conservative PDF readers for inbox review.
 * Treat every file as untrusted. Bound inflate size. Never execute PDF JavaScript.
 */

const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_INFLATE_BYTES = 1_500_000;
const MAX_STREAMS = 16;
const MAX_TEXT_CHARS = 8000;
const JPEG_SOI = [0xff, 0xd8, 0xff];
const JPEG_EOI = [0xff, 0xd9];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IEND = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function latin1Slice(bytes: Uint8Array): string {
  const view = bytes.subarray(0, Math.min(bytes.length, MAX_SCAN_BYTES));
  return new TextDecoder("latin1").decode(view);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function unescapePdfLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, " ")
    .replace(/\\f/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{1,3})/g, (_, digits) => String.fromCharCode(parseInt(digits, 8) || 32));
}

export function extractPdfLiteralStrings(source: string): string {
  const chunks: string[] = [];
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const tjArray = /\[(?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*\s*)+\]\s*TJ/g;

  let match: RegExpExecArray | null;
  while ((match = tj.exec(source))) {
    const inner = match[0].replace(/\)\s*Tj$/, "").slice(1);
    const text = unescapePdfLiteral(inner).trim();
    if (text) chunks.push(text);
    if (chunks.join(" ").length >= MAX_TEXT_CHARS) break;
  }

  while ((match = tjArray.exec(source))) {
    const parts = match[0].match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    for (const part of parts) {
      const text = unescapePdfLiteral(part.slice(1, -1)).trim();
      if (text) chunks.push(text);
    }
    if (chunks.join(" ").length >= MAX_TEXT_CHARS) break;
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

async function inflateBounded(data: Uint8Array, encoding: CompressionFormat): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([toArrayBuffer(data)]).stream().pipeThrough(new DecompressionStream(encoding));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_INFLATE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

async function decodeStream(data: Uint8Array): Promise<string> {
  const zlib = await inflateBounded(data, "deflate");
  const raw = zlib ?? (await inflateBounded(data, "deflate-raw"));
  const bytes = raw ?? data;
  return latin1Slice(bytes);
}

function streamPayloads(bytes: Uint8Array): Uint8Array[] {
  const latin1 = latin1Slice(bytes);
  const payloads: Uint8Array[] = [];
  let cursor = 0;
  while (payloads.length < MAX_STREAMS) {
    const startToken = latin1.indexOf("stream", cursor);
    if (startToken < 0) break;
    let dataStart = startToken + 6;
    if (latin1[dataStart] === "\r") dataStart += 1;
    if (latin1[dataStart] === "\n") dataStart += 1;
    const endToken = latin1.indexOf("endstream", dataStart);
    if (endToken < 0) break;
    let dataEnd = endToken;
    if (latin1[dataEnd - 1] === "\n") dataEnd -= 1;
    if (latin1[dataEnd - 1] === "\r") dataEnd -= 1;
    if (dataEnd > dataStart) {
      payloads.push(bytes.subarray(dataStart, dataEnd));
    }
    cursor = endToken + 9;
  }
  return payloads;
}

export async function extractPdfPlainText(bytes: Uint8Array): Promise<string> {
  if (!isPdfBytes(bytes)) return "";
  const scan = bytes.subarray(0, Math.min(bytes.length, MAX_SCAN_BYTES));
  const direct = extractPdfLiteralStrings(latin1Slice(scan));
  const decoded: string[] = [];
  if (direct) decoded.push(direct);

  for (const payload of streamPayloads(scan)) {
    const text = extractPdfLiteralStrings(await decodeStream(payload));
    if (text) decoded.push(text);
    if (decoded.join(" ").length >= MAX_TEXT_CHARS) break;
  }

  return decoded.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

function indexOfSeq(bytes: Uint8Array, seq: number[], from = 0): number {
  outer: for (let i = from; i <= bytes.length - seq.length; i += 1) {
    for (let j = 0; j < seq.length; j += 1) {
      if (bytes[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function collectEmbeddedImages(bytes: Uint8Array): { mime: string; bytes: Uint8Array }[] {
  const scan = bytes.subarray(0, Math.min(bytes.length, MAX_SCAN_BYTES));
  const found: { mime: string; bytes: Uint8Array }[] = [];

  let jpegAt = 0;
  while (found.length < 8) {
    const start = indexOfSeq(scan, JPEG_SOI, jpegAt);
    if (start < 0) break;
    const end = indexOfSeq(scan, JPEG_EOI, start + 3);
    if (end < 0) break;
    const payload = scan.subarray(start, end + 2);
    if (payload.length >= 64) found.push({ mime: "image/jpeg", bytes: payload });
    jpegAt = end + 2;
  }

  let pngAt = 0;
  while (found.length < 12) {
    const start = indexOfSeq(scan, PNG_SIG, pngAt);
    if (start < 0) break;
    const end = indexOfSeq(scan, PNG_IEND, start + 8);
    if (end < 0) break;
    const payload = scan.subarray(start, end + PNG_IEND.length);
    if (payload.length >= 32) found.push({ mime: "image/png", bytes: payload });
    pngAt = end + PNG_IEND.length;
  }

  return found;
}

/** Best embedded page image, if the PDF is a scan / image-based certificate. */
export function extractPdfEmbeddedImage(bytes: Uint8Array): Blob | null {
  if (!isPdfBytes(bytes)) return null;
  const images = collectEmbeddedImages(bytes);
  if (images.length === 0) return null;
  images.sort((a, b) => b.bytes.length - a.bytes.length);
  const best = images[0];
  return new Blob([toArrayBuffer(best.bytes)], { type: best.mime });
}
