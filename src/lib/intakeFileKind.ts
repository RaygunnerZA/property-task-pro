/**
 * How an inbox file can be opened, previewed, and read locally.
 * Format checks are deterministic — they do not trust the browser MIME alone.
 */

export type IntakeFileKind = "image" | "pdf" | "office" | "text" | "audio" | "video" | "unknown";

export type IntakePreviewKind = "image" | "pdf" | "office" | "text" | "none";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"]);
const HEIC_EXT = new Set(["heic", "heif"]);
const PDF_EXT = new Set(["pdf"]);
const OFFICE_EXT = new Set(["docx", "doc", "xlsx", "xls"]);
const TEXT_EXT = new Set(["txt", "csv", "md"]);

export function fileExtension(fileName?: string | null): string {
  const name = (fileName || "").trim();
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function normalizeInboxContentType(
  mimeType?: string | null,
  fileName?: string | null
): string {
  const mime = (mimeType || "").trim().toLowerCase();
  const ext = fileExtension(fileName);

  if (mime && mime !== "application/octet-stream" && mime !== "binary/octet-stream") {
    if (mime === "image/jpg") return "image/jpeg";
    return mime;
  }

  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "avif") return "image/avif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "txt") return "text/plain";
  if (ext === "csv") return "text/csv";
  return mime || "application/octet-stream";
}

export function intakeFileKind(mimeType?: string | null, fileName?: string | null): IntakeFileKind {
  const mime = normalizeInboxContentType(mimeType, fileName);
  const ext = fileExtension(fileName);

  if (mime.startsWith("image/") || IMAGE_EXT.has(ext) || HEIC_EXT.has(ext)) return "image";
  if (mime.includes("pdf") || PDF_EXT.has(ext)) return "pdf";
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    mime.includes("spreadsheetml") ||
    mime.includes("excel") ||
    OFFICE_EXT.has(ext)
  ) {
    return "office";
  }
  if (mime.startsWith("text/") || TEXT_EXT.has(ext)) return "text";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "unknown";
}

export function intakePreviewKind(mimeType?: string | null, fileName?: string | null): IntakePreviewKind {
  const kind = intakeFileKind(mimeType, fileName);
  const ext = fileExtension(fileName);
  if (kind === "image") {
    // HEIC often cannot be painted by the browser <img> even when we have a URL.
    if (HEIC_EXT.has(ext) || (mimeType || "").toLowerCase().includes("heic") || (mimeType || "").toLowerCase().includes("heif")) {
      return "none";
    }
    return "image";
  }
  if (kind === "pdf") return "pdf";
  if (kind === "office") return "office";
  if (kind === "text") return "text";
  return "none";
}

/** The browser can display the original bytes (image/PDF/text), not just download them. */
export function canOpenInBrowser(mimeType?: string | null, fileName?: string | null): boolean {
  const preview = intakePreviewKind(mimeType, fileName);
  return preview === "image" || preview === "pdf" || preview === "text";
}

/** Local parsers can pull readable text without a model. */
export function canExtractTextLocally(mimeType?: string | null, fileName?: string | null): boolean {
  const kind = intakeFileKind(mimeType, fileName);
  return kind === "pdf" || kind === "office" || kind === "text";
}

export function blobForInboxFile(
  bytes: Blob | ArrayBuffer | Uint8Array,
  mimeType?: string | null,
  fileName?: string | null
): Blob {
  const type = normalizeInboxContentType(mimeType, fileName);
  if (bytes instanceof Blob) {
    if (bytes.type && bytes.type !== "application/octet-stream") return bytes;
    return new Blob([bytes], { type });
  }
  if (bytes instanceof ArrayBuffer) {
    return new Blob([bytes], { type });
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}
