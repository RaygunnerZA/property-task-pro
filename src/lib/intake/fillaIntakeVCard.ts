/**
 * Personal Fwd → Filla vCard (vCard 3.0).
 * Token appears only in EMAIL — never in FN, ORG, NOTE, or filename.
 */

const CONTACT_NOTE =
  "Forward or CC property emails here. Suggestions wait in Filla Needs review until you confirm them.";

/** Fold long vCard lines at 75 octets (RFC 6350 soft line breaks). */
export function foldVCardLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

export function sanitizeVCardFilenamePart(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "Organisation";
}

export function fillaIntakeContactDisplayName(orgName: string | null, multiOrg: boolean): string {
  if (multiOrg && orgName?.trim()) {
    return `Fwd → Filla – ${orgName.trim()}`;
  }
  return "Fwd → Filla";
}

export function fillaIntakeVCardFilename(orgName: string | null, multiOrg: boolean): string {
  if (multiOrg && orgName?.trim()) {
    return `Fwd-Filla-${sanitizeVCardFilenamePart(orgName)}.vcf`;
  }
  return "Fwd-Filla.vcf";
}

export function buildFillaIntakeVCard(input: {
  email: string;
  orgName: string | null;
  multiOrg: boolean;
  /** Raw PNG bytes for PHOTO; omit if unavailable. */
  photoPngBase64?: string | null;
}): string {
  const email = input.email.trim();
  if (!email || !email.includes("@")) {
    throw new Error("Valid Filla address required");
  }

  const fn = fillaIntakeContactDisplayName(input.orgName, input.multiOrg);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fn}`,
    "N:;Fwd → Filla;;;",
    "ORG:Filla",
    `EMAIL;TYPE=INTERNET:${email}`,
    `NOTE:${CONTACT_NOTE}`,
  ];

  if (input.photoPngBase64?.trim()) {
    const photo = input.photoPngBase64.replace(/\s+/g, "");
    lines.push(foldVCardLine(`PHOTO;ENCODING=b;TYPE=PNG:${photo}`));
  }

  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

const VCARD_MIME = "text/vcard;charset=utf-8";

export function downloadTextFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari cancels the download if the blob URL is revoked immediately.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** True when Apple Safari / iOS usually prefers Contacts handoff language in the UI. */
export function prefersContactsHandoff(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isSafariDesktop =
    /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox/.test(ua);
  return isAppleMobile || isSafariDesktop;
}

/**
 * Start a .vcf download / Contacts import.
 *
 * Must run synchronously inside a user gesture (Safari blocks downloads after `await`).
 * Uses a Blob object URL — Safari silently ignores programmatic `data:` navigations.
 * MIME is `text/vcard` so iOS can hand off to Contacts; desktop Safari saves then opens.
 */
export function openVCardForImport(filename: string, contents: string): "opened" | "downloaded" {
  downloadTextFile(filename, contents, VCARD_MIME);
  return prefersContactsHandoff() ? "opened" : "downloaded";
}

export async function pngUrlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load contact photo");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export { CONTACT_NOTE as FILLA_INTAKE_VCARD_NOTE };
