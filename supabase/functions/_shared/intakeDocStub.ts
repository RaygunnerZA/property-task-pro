/** Filename / light-text fallback when full document AI is skipped or unavailable. */

export function humanizeIntakeFileStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const withoutIndex = stem.replace(/^\d+[_\-\s.]+/, "");
  const cleaned = withoutIndex.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return stem.replace(/[_-]+/g, " ").trim() || "Upload";
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function inferDocTypeFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("eicr") || lower.includes("electrical")) return "EICR";
  if (lower.includes("epc") || lower.includes("energy performance")) return "EPC";
  if (lower.includes("gas")) return "Gas Safety Certificate";
  if (lower.includes("fire") && lower.includes("risk")) return "Fire Risk Assessment";
  if (lower.includes("fire")) return "Fire Certificate";
  if (lower.includes("pat")) return "PAT Test";
  if (lower.includes("legionella")) return "Legionella Risk Assessment";
  if (lower.includes("asbestos")) return "Asbestos Register";
  return null;
}

function inferOutcomeFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase().replace(/[_./\\-]+/g, " ");
  if (/\bunsatisfactory\b|\bfail(?:ed|ure)?\b/.test(lower)) return "unsatisfactory";
  if (/\bexpired\b/.test(lower)) return "expired";
  if (/\bsatisfactory\b|\bpass(?:ed)?\b/.test(lower)) return "satisfactory";
  if (/\bvalid\b/.test(lower)) return "valid";
  return null;
}

function inferCategoryFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("epc") || lower.includes("energy")) return "Misc";
  if (lower.includes("plan") || lower.includes("drawing")) return "Plans";
  if (lower.includes("lease") || lower.includes("contract") || lower.includes("legal")) return "Legal";
  if (lower.includes("fire") || lower.includes("safety")) return "Fire Safety";
  if (lower.includes("electrical") || lower.includes("eic")) return "Electrical";
  if (lower.includes("gas") || lower.includes("hvac")) return "Mechanical";
  if (lower.includes("water") || lower.includes("plumb") || lower.includes("legionella")) return "Water";
  if (lower.includes("insurance")) return "Insurance";
  return "Misc";
}

export function buildIntakeDocStub(
  fileName: string,
  ocrText?: string | null
): Record<string, unknown> {
  const title =
    humanizeIntakeFileStem(fileName)
      .replace(/\b(unsatisfactory|satisfactory|failed|fail|pass|passed|expired|valid)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || humanizeIntakeFileStem(fileName);
  const document_type = inferDocTypeFromFilename(fileName);
  const outcome = inferOutcomeFromFilename(`${fileName} ${ocrText || ""}`);
  const summary = [
    document_type ? `This is a ${document_type}.` : "This looks like a property document.",
    outcome === "unsatisfactory"
      ? "The outcome is unsatisfactory — file the record and consider follow-up work."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title,
    document_type,
    category: inferCategoryFromFilename(fileName),
    expiry_date: null,
    renewal_frequency: null,
    confidence: ocrText ? 0.55 : 0.35,
    ocr_text: ocrText?.slice(0, 2000) || null,
    summary,
    outcome,
    findings: [],
    detected_spaces: [],
    detected_assets: [],
    compliance_recommendations: [],
    hazards: [],
    metadata: { stub: true, source: ocrText ? "document_text" : "filename" },
  };
}

export function isUsableDocAnalysis(result: Record<string, unknown>): boolean {
  if (result.ok === false || result.skipped === true) return false;
  if (typeof result.error === "string" && result.error.length > 0) return false;
  return Boolean(
    result.document_type ||
      result.expiry_date ||
      (typeof result.ocr_text === "string" && result.ocr_text.trim().length >= 40) ||
      (typeof result.summary === "string" && result.summary.trim().length >= 12)
  );
}
