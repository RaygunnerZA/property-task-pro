/**
 * Conservative PDF text extraction for Edge document analysis.
 * Treat every file as untrusted. Bound inflate size. Never execute PDF JavaScript.
 */

const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_INFLATE_BYTES = 1_500_000;
const MAX_STREAMS = 16;
const MAX_TEXT_CHARS = 8000;

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
