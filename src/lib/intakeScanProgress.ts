/**
 * Rotating status copy while Add Record / compliance documents are being read.
 * Progress-oriented expectations — not fake completion percentages.
 */

export const INTAKE_DOC_SCAN_MESSAGES = [
  "Reading document…",
  "Looking for dates and certificate type…",
  "Checking findings and next steps…",
  "Large PDFs can take a little longer…",
  "Almost there — preparing suggestions…",
] as const;

export const INTAKE_IMAGE_SCAN_MESSAGES = [
  "Reading document…",
  "Looking for dates and certificate type…",
  "Checking findings and next steps…",
  "Almost there — preparing suggestions…",
] as const;

export function intakeScanMessageAt(
  messages: readonly string[],
  startedAtMs: number,
  nowMs = Date.now(),
  intervalMs = 3200
): string {
  if (!messages.length) return "Reading document…";
  const elapsed = Math.max(0, nowMs - startedAtMs);
  const index = Math.floor(elapsed / intervalMs) % messages.length;
  return messages[index] ?? messages[0];
}
