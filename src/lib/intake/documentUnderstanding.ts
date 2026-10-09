/**
 * Evidence-aware document reading.
 * A phrase in the file is a statement. It becomes a property fact only when the
 * rest of the document supports that reading.
 */

import { normalizeIntakeExpiryDate } from "@/lib/mapIntakeDocumentType";

export type PromotedDocOutcome =
  | "unsatisfactory"
  | "satisfactory"
  | "expired"
  | "valid"
  | "unknown";

export type DocumentAuthority =
  | "current"
  | "not_valid"
  | "draft"
  | "superseded"
  | "unknown";

export type PropertyApplicability = "matches" | "other" | "unknown";

export type StatementBasis = "stated" | "interpreted" | "filename";

export interface DocumentStatement {
  kind: "status" | "field" | "narrative" | "reference" | "filename";
  text: string;
  basis: StatementBasis;
}

export interface DocumentUnderstanding {
  authority: DocumentAuthority;
  /** Replaces a Valid/Expired chip when the document itself withholds that status. */
  statusLabel: string | null;
  summary: string;
  applicability: PropertyApplicability;
  contradictions: string[];
  /** True when the document conflicts with itself and the conflict was not resolved. */
  unresolved: boolean;
  promotedOutcome: PromotedDocOutcome;
  promotedExpiry: string | null;
  withheldExpiry: string | null;
  serviceCompletedOn: string | null;
  warrantyStatement: string | null;
  statements: DocumentStatement[];
}

export interface DocumentUnderstandingInput {
  text: string;
  fileName?: string | null;
  documentType?: string | null;
  propertyName?: string | null;
  propertyAddress?: string | null;
  asOf?: Date;
}

const DATE_CAPTURE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/;

const EXPIRY_LABEL =
  /(?:certificate\s+(?:is\s+)?valid\s+until|valid\s+until|expiry|expires|expiration)/i;

const HISTORICAL =
  /\b(?:previous|prior|former|earlier|old|last|original)\b/i;

const STREET =
  /\b\d{1,4}\s+[a-z0-9][a-z0-9'’.-]*(?:\s+[a-z0-9'’.-]+){0,4}\s+(?:road|street|lane|avenue|drive|close|way|place|terrace|gardens|court|crescent|hill|row)\b/i;

const TOKEN_STOP = new Set([
  "road",
  "street",
  "lane",
  "avenue",
  "drive",
  "close",
  "place",
  "terrace",
  "gardens",
  "court",
  "london",
  "house",
  "property",
  "certificate",
  "energy",
  "performance",
]);

function snippet(text: string, index: number, length = 140): string {
  const start = Math.max(0, index - 40);
  const raw = text.slice(start, index + length).replace(/\s+/g, " ").trim();
  return raw.slice(0, 180);
}

function formatIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function isBeforeDay(iso: string, asOf: Date): boolean {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return date < today;
}

function distinctiveTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 5 && !TOKEN_STOP.has(token) && !/^\d+$/.test(token));
}

function propertyApplicability(
  text: string,
  propertyName?: string | null,
  propertyAddress?: string | null
): PropertyApplicability {
  const hint = [propertyName, propertyAddress].filter(Boolean).join(" ");
  if (!hint.trim()) return "unknown";
  const tokens = distinctiveTokens(hint);
  const lower = text.toLowerCase();
  const tokenHit = tokens.some((token) => new RegExp(`\\b${token}\\b`, "i").test(lower));
  const numbers = (propertyAddress || "").match(/\b\d{1,4}\b/g) ?? [];
  const numberHit = numbers.length === 0 || numbers.some((number) => new RegExp(`\\b${number}\\b`).test(text));
  if (tokenHit && numberHit) return "matches";
  if (STREET.test(text) && !tokenHit) return "other";
  return "unknown";
}

interface DatedClaim {
  iso: string;
  index: number;
  historical: boolean;
  text: string;
}

function datedClaims(text: string): DatedClaim[] {
  const pattern = new RegExp(`${EXPIRY_LABEL.source}[\\s\\S]{0,40}?${DATE_CAPTURE.source}`, "gi");
  const claims: DatedClaim[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const iso = normalizeIntakeExpiryDate(match[1]);
    if (!iso) continue;
    const before = text.slice(Math.max(0, match.index - 60), match.index);
    const clause = before.split(/[.\n]/).pop() ?? before;
    claims.push({
      iso,
      index: match.index,
      historical: HISTORICAL.test(clause),
      text: snippet(text, match.index, match[0].length),
    });
  }
  return claims;
}

function completedServiceDate(text: string): string | null {
  const completed =
    /\b(?:annual\s+)?(?:boiler\s+)?service(?:d|ing)?\s+(?:was\s+)?completed\b[\s\S]{0,40}?(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}|\d{4}-\d{2}-\d{2})/i;
  const match = text.match(completed);
  if (!match?.[1]) return null;
  return normalizeIntakeExpiryDate(match[1]);
}

function authorityOf(text: string): { authority: DocumentAuthority; label: string | null; snippet: string | null } {
  const rules: Array<{ pattern: RegExp; authority: DocumentAuthority; label: string }> = [
    { pattern: /\bnot\s+valid\b|\binvalid\b|\bvoid\b/i, authority: "not_valid", label: "Not valid" },
    { pattern: /\bsynthetic\b/i, authority: "not_valid", label: "Not valid" },
    { pattern: /\bcancell?ed\b/i, authority: "not_valid", label: "Not valid" },
    { pattern: /\bsuperseded\b/i, authority: "superseded", label: "Superseded" },
    { pattern: /\bdraft\b/i, authority: "draft", label: "Draft" },
    { pattern: /\bsample\b/i, authority: "draft", label: "Sample" },
    { pattern: /\bfor information only\b/i, authority: "draft", label: "For information only" },
  ];
  for (const rule of rules) {
    const match = rule.pattern.exec(text);
    if (!match || match.index == null) continue;
    return { authority: rule.authority, label: rule.label, snippet: snippet(text, match.index, match[0].length) };
  }
  return { authority: "unknown", label: null, snippet: null };
}

/**
 * Read the whole text before promoting any field.
 */
export function interpretDocument(input: DocumentUnderstandingInput): DocumentUnderstanding {
  const text = input.text.replace(/\u0000/g, " ").trim();
  const asOf = input.asOf ?? new Date();
  const statements: DocumentStatement[] = [];
  const contradictions: string[] = [];

  if (!text) {
    if (input.fileName) {
      statements.push({ kind: "filename", text: input.fileName, basis: "filename" });
    }
    return {
      authority: "unknown",
      statusLabel: null,
      summary: "",
      applicability: "unknown",
      contradictions,
      unresolved: false,
      promotedOutcome: "unknown",
      promotedExpiry: null,
      withheldExpiry: null,
      serviceCompletedOn: null,
      warrantyStatement: null,
      statements,
    };
  }

  const banner = authorityOf(text);
  if (banner.snippet) {
    statements.push({ kind: "status", text: banner.snippet, basis: "stated" });
  }

  const claims = datedClaims(text);
  for (const claim of claims) {
    statements.push({
      kind: claim.historical ? "reference" : "field",
      text: claim.text,
      basis: "stated",
    });
  }
  const currentClaims = claims.filter((claim) => !claim.historical);
  const historicalClaims = claims.filter((claim) => claim.historical);
  const uniqueCurrent = [...new Set(currentClaims.map((claim) => claim.iso))];

  const requiresService = /\b(?:requires|needs)\s+servic(?:e|ing)\b|\bservic(?:e|ing)\s+is\s+(?:required|recommended)\b/i.test(
    text
  );
  const completedOn = completedServiceDate(text);
  if (requiresService) {
    const match = text.match(/\b(?:requires|needs)\s+servic(?:e|ing)\b|\bservic(?:e|ing)\s+is\s+(?:required|recommended)\b/i);
    statements.push({
      kind: "narrative",
      text: snippet(text, match?.index ?? 0, 80),
      basis: "stated",
    });
  }
  if (completedOn) {
    statements.push({
      kind: "narrative",
      text: `Service completed on ${formatIso(completedOn)}`,
      basis: "stated",
    });
  }

  const warranty = text.match(/\b[^.!\n]{0,80}\bwarrant[^.!\n]{0,80}/i);
  const isInvoice = /\binvoice\b|\breceipt\b/i.test(text);
  const warrantyStatement = isInvoice && warranty ? warranty[0].replace(/\s+/g, " ").trim().slice(0, 180) : null;
  if (warrantyStatement) {
    statements.push({ kind: "narrative", text: warrantyStatement, basis: "stated" });
  }

  const applicability = propertyApplicability(text, input.propertyName, input.propertyAddress);

  let unresolved = false;
  if (
    /\boverall\s+assessment:\s*(?<!un)satisfactory\b/i.test(text) &&
    /\boverall\s+assessment:\s*unsatisfactory\b/i.test(text)
  ) {
    unresolved = true;
    contradictions.push("The document states both a satisfactory and an unsatisfactory overall assessment.");
  }
  if (requiresService && completedOn) {
    unresolved = true;
    contradictions.push("The document both requires servicing and says a service was completed.");
  }
  if (uniqueCurrent.length > 1) {
    unresolved = true;
    contradictions.push("The document gives more than one current valid-until date.");
  }

  const candidateExpiry = uniqueCurrent.length === 1 ? uniqueCurrent[0] : null;
  const limitsStatus = banner.authority !== "unknown";
  if (limitsStatus && candidateExpiry) {
    contradictions.push(
      `The document says it is ${banner.label?.toLowerCase()}, and it also includes a valid-until date of ${formatIso(candidateExpiry)}.`
    );
  }

  let promotedOutcome: PromotedDocOutcome = "unknown";
  let promotedExpiry: string | null = null;
  let withheldExpiry: string | null = null;
  let serviceCompletedOn: string | null = null;

  if (!unresolved && !limitsStatus && applicability !== "other") {
    if (/\bunsatisfactory\b|\bfail(?:ed|ure)?\b/i.test(text) && !/\bnot\s+unsatisfactory\b/i.test(text)) {
      promotedOutcome = "unsatisfactory";
    } else if (/\b(?<!un)satisfactory\b|\bpass(?:ed)?\b/i.test(text) && !requiresService) {
      promotedOutcome = "satisfactory";
    }
    if (candidateExpiry) {
      promotedExpiry = candidateExpiry;
      if (promotedOutcome === "unknown") {
        promotedOutcome = isBeforeDay(candidateExpiry, asOf) ? "expired" : "valid";
      }
    }
    if (completedOn && !requiresService) serviceCompletedOn = completedOn;
  } else if (candidateExpiry) {
    withheldExpiry = candidateExpiry;
  }

  if (historicalClaims.length > 0 && !promotedExpiry) {
    withheldExpiry = withheldExpiry ?? null;
  }

  const statusLabel = limitsStatus ? banner.label : null;
  const withheldDate =
    candidateExpiry && (limitsStatus || applicability === "other" || unresolved)
      ? ` A valid-until date of ${formatIso(candidateExpiry)} is in the text and is not treated as the certificate status.`
      : "";
  const observationCodes = [...new Set([...text.matchAll(/\bC[123]\b/g)].map((match) => match[0]))];
  let summary = "";
  if (applicability === "other") {
    summary = `The address does not match this property.${withheldDate}`;
  } else if (unresolved) {
    summary = contradictions[0] || "The document contradicts itself, so no status was applied.";
  } else if (limitsStatus) {
    summary = `The document says it is ${banner.label?.toLowerCase()}.${withheldDate}`;
  } else if (serviceCompletedOn) {
    summary = `The document states that the service was completed on ${formatIso(serviceCompletedOn)}.`;
  } else if (requiresService) {
    summary = "The document states that servicing is required. That is not a record of a completed service.";
  } else if (warrantyStatement) {
    summary = "It mentions a warranty; the invoice itself is not a warranty certificate.";
  } else if (promotedOutcome === "unsatisfactory") {
    summary =
      observationCodes.length > 0
        ? `${observationCodes.join(" and ")} ${observationCodes.length === 1 ? "needs" : "need"} remedial work. Filing this does not close ${observationCodes.length === 1 ? "it" : "them"}.`
        : "Not a clean result — remedial work is usually needed. Filing this does not close that.";
  } else if (promotedOutcome === "satisfactory") {
    summary = /all appliances passed/i.test(text)
      ? "All appliances passed. Ready to keep as the current certificate."
      : "Reads as a clean inspection. Ready to keep as the current certificate.";
  } else if (promotedOutcome === "expired" && promotedExpiry) {
    summary = `The valid-until date ${formatIso(promotedExpiry)} is in the past, so this should not stand as the current certificate.`;
  } else if (promotedOutcome === "valid") {
    summary = "Ready to keep as the current certificate.";
  }

  return {
    authority: limitsStatus ? banner.authority : promotedOutcome === "unknown" ? "unknown" : "current",
    statusLabel,
    summary,
    applicability,
    contradictions,
    unresolved,
    promotedOutcome,
    promotedExpiry,
    withheldExpiry,
    serviceCompletedOn,
    warrantyStatement,
    statements: statements.slice(0, 6),
  };
}
