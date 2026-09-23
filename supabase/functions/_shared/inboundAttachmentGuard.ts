/**
 * Bounds and content checks for inbound email attachments.
 * This is type and signature enforcement, not a full antivirus engine.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 8;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "com", "scr", "msi", "js", "mjs", "html", "htm",
  "svg", "zip", "rar", "7z", "gz", "jar", "sh", "ps1", "app", "dmg",
]);

export type AttachmentInspection =
  | { ok: true; mime: string }
  | { ok: false; reason: string };

function extensionOf(fileName: string): string {
  const base = fileName.trim().toLowerCase().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1) : "";
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function asciiPrefix(bytes: Uint8Array, length: number): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, length));
  let text = "";
  for (const value of slice) {
    if (value === 0) return text + "\u0000";
    text += String.fromCharCode(value);
  }
  return text;
}

function familyForMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/heic" || mime === "image/heif") return "heif";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "ooxml";
  }
  if (mime === "application/msword" || mime === "application/vnd.ms-excel") return "ole";
  if (mime === "text/plain" || mime === "text/csv") return "text";
  return "unknown";
}

function detectedFamily(bytes: Uint8Array): string {
  if (startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "executable";
  if (asciiPrefix(bytes, 5).startsWith("%PDF")) return "pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (asciiPrefix(bytes, 6).startsWith("GIF87a") || asciiPrefix(bytes, 6).startsWith("GIF89a")) return "gif";
  if (asciiPrefix(bytes, 4) === "RIFF" && asciiPrefix(bytes.subarray(8), 4) === "WEBP") return "webp";
  if (asciiPrefix(bytes.subarray(4), 4) === "ftyp") return "heif";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "ole";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "ooxml";
  return "text";
}

export function inspectInboundAttachment(input: {
  fileName: string;
  declaredMime: string;
  bytes: Uint8Array;
}): AttachmentInspection {
  const mime = input.declaredMime.trim().toLowerCase();
  const ext = extensionOf(input.fileName);
  if (BLOCKED_EXTENSIONS.has(ext)) return { ok: false, reason: "blocked_extension" };
  if (!ALLOWED_MIME.has(mime)) return { ok: false, reason: "mime_not_allowed" };
  if (input.bytes.byteLength === 0) return { ok: false, reason: "empty_file" };
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) return { ok: false, reason: "file_too_large" };

  const prefix = asciiPrefix(input.bytes, 240).toLowerCase();
  if (prefix.includes("\u0000") && familyForMime(mime) === "text") {
    return { ok: false, reason: "binary_text" };
  }
  if (prefix.includes("<script") || prefix.includes("<html") || prefix.includes("<!doctype html")) {
    return { ok: false, reason: "active_content" };
  }

  const detected = detectedFamily(input.bytes);
  if (detected === "executable") return { ok: false, reason: "executable_content" };
  const expected = familyForMime(mime);
  if (detected !== expected) return { ok: false, reason: "content_mismatch" };
  return { ok: true, mime };
}
