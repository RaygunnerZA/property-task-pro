import { validateInboundEmailProposal, type InboundEmailProposal } from "../../../supabase/functions/_shared/inboundEmailTriage.ts";

export type { InboundEmailProposal };

export const EXTERNAL_SENDER_LABEL = "External sender—not verified as you";

export function readInboundEmailProposal(raw: unknown): InboundEmailProposal | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!("outcome" in raw)) return null;
  try {
    return validateInboundEmailProposal(raw);
  } catch {
    return null;
  }
}

export function inboundEmailOutcomeLabel(proposal: InboundEmailProposal): string {
  if (proposal.outcome === "task" && proposal.task_fields?.reminder) return "Suggested reminder";
  if (proposal.outcome === "task") return "Suggested task";
  if (proposal.outcome === "record") return "Suggested record";
  if (proposal.outcome === "knowledge") return "Suggested Knowledge";
  return "Needs a decision";
}

export function inboundEmailSenderLabel(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return null;
  const row = provenance as Record<string, unknown>;
  if (row.channel !== "member_intake_email") return null;
  if (row.sender_verified === false || row.authorship === "external") return EXTERNAL_SENDER_LABEL;
  return null;
}
