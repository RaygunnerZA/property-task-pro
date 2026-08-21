/**
 * Read text out of Office files in the browser or Edge.
 * Word/Excel are ZIP packages — they must not be sent to vision models as images.
 */

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const EOCD = 0x06054b50;

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("deflate is not available");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEocd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (u32(view, i) === EOCD) return i;
  }
  return -1;
}

async function readZipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  if (eocd < 0) return readZipEntryLocal(bytes, wanted);

  const cdOffset = u32(view, eocd + 16);
  const cdEntries = u16(view, eocd + 10);
  let offset = cdOffset;

  for (let i = 0; i < cdEntries && offset + 46 <= bytes.length; i += 1) {
    if (u32(view, offset) !== CENTRAL_HEADER) break;
    const method = u16(view, offset + 10);
    const compSize = u32(view, offset + 20);
    const nameLen = u16(view, offset + 28);
    const extraLen = u16(view, offset + 30);
    const commentLen = u16(view, offset + 32);
    const localOffset = u32(view, offset + 42);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    if (name === wanted || name.replace(/\\/g, "/") === wanted) {
      const localNameLen = u16(view, localOffset + 26);
      const localExtraLen = u16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const packed = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) return packed;
      if (method === 8) return inflateRaw(packed);
      return null;
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

async function readZipEntryLocal(bytes: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (u32(view, offset) !== LOCAL_HEADER) break;
    const flags = u16(view, offset + 6);
    const method = u16(view, offset + 8);
    const compSize = u32(view, offset + 18);
    const nameLen = u16(view, offset + 26);
    const extraLen = u16(view, offset + 28);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    if (flags & 0x8) {
      // Data descriptor — skip this entry; central directory path is preferred.
      break;
    }
    const packed = bytes.subarray(dataStart, dataStart + compSize);
    if (name === wanted || name.replace(/\\/g, "/") === wanted) {
      if (method === 0) return packed;
      if (method === 8) return inflateRaw(packed);
      return null;
    }
    offset = dataStart + compSize;
  }
  return null;
}

export function wordXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^/]*\/>/g, "\t")
    .replace(/<w:br\b[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isOfficeDocument(mimeType: string | null | undefined, fileName?: string | null): boolean {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mime.includes("wordprocessingml") || mime.includes("msword") || mime.includes("officedocument.word")) {
    return true;
  }
  if (mime.includes("spreadsheetml") || mime.includes("excel")) return true;
  return /\.(docx|doc|xlsx|xls)$/i.test(name);
}

export function isVisionDocument(mimeType: string | null | undefined, fileName?: string | null): boolean {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (mime.includes("pdf") || name.endsWith(".pdf")) return true;
  return false;
}

export async function extractOfficePlainText(
  buffer: ArrayBuffer,
  fileName?: string | null
): Promise<string> {
  const name = (fileName || "").toLowerCase();
  const bytes = new Uint8Array(buffer);
  if (name.endsWith(".docx") || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    const xmlBytes = await readZipEntry(bytes, "word/document.xml");
    if (xmlBytes) return wordXmlToText(new TextDecoder("utf-8").decode(xmlBytes));
    const shared = await readZipEntry(bytes, "xl/sharedStrings.xml");
    if (shared) return wordXmlToText(new TextDecoder("utf-8").decode(shared));
  }
  return "";
}
