/**
 * Map ai-doc-analyse output → proposed Knowledge candidates (extraction only; no auto-create).
 * Shared by platform admin intake and future org-scoped customer upload.
 */

import type { KnowledgeApplicability } from "@/types/knowledge";
import { EMPTY_APPLICABILITY } from "@/types/knowledge";
import {
  mergeClaimsWithAttributeFallback,
  serializeClaimsForRpc,
  type KnowledgeClaimRow,
} from "@/lib/knowledge/knowledgeClaims";

/** Platform sentinel org for AI metering on admin/platform intake. */
export const PLATFORM_AI_ORG_ID = "00000000-0000-0000-0000-000000000000";

export type KnowledgeIntakeMode = "upload" | "url" | "manual";

export type KnowledgeSourceProvenance = {
  source_url?: string;
  source_document?: string;
  retrieved_date?: string;
  citation?: string;
  verification_status?: string;
  storage_bucket?: string;
  storage_path?: string;
  intake_mode?: KnowledgeIntakeMode;
  document_type?: string | null;
  extractor?: string;
};

export type DocAnalyseKnowledgeProposal = {
  title: string;
  summary?: string | null;
  body?: string | null;
  attributes?: Record<string, string>;
  /** Source-backed facts; established:false = explicit unknown (do not invent). */
  claims?: Array<{
    text?: string;
    claim_text?: string;
    category?: string;
    source_location?: string;
    established?: boolean;
  }>;
};

export type DocAnalysePayload = {
  ok?: boolean;
  skipped?: boolean;
  error?: string;
  title?: string | null;
  document_type?: string | null;
  category?: string | null;
  summary?: string | null;
  ocr_text?: string | null;
  outcome?: string | null;
  findings?: string[];
  compliance_recommendations?: string[];
  hazards?: string[];
  confidence?: number;
  knowledge_proposals?: DocAnalyseKnowledgeProposal[];
};

export type ProposedKnowledgeCandidate = {
  clientId: string;
  title: string;
  summary: string;
  body: string;
  attributes: Record<string, string>;
  claims: KnowledgeClaimRow[];
  provenance: KnowledgeSourceProvenance;
  applicability: KnowledgeApplicability;
  selected: boolean;
};

function newClientId(): string {
  return crypto.randomUUID();
}

function clip(s: string | null | undefined, max: number): string {
  return (s ?? "").trim().slice(0, max);
}

function baseAttributes(analysis: DocAnalysePayload): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (analysis.category) attrs.category = analysis.category;
  if (analysis.document_type) attrs.legal_status = analysis.document_type;
  if (analysis.outcome) attrs.evidence = analysis.outcome;
  if (analysis.hazards?.length) attrs.risk_or_consequence = analysis.hazards.slice(0, 3).join("; ");
  return attrs;
}

function proposalRow(
  partial: {
    title: string;
    summary?: string;
    body?: string;
    attributes?: Record<string, string>;
    claims?: DocAnalyseKnowledgeProposal["claims"];
  },
  source: KnowledgeSourceProvenance,
  analysis: DocAnalysePayload
): ProposedKnowledgeCandidate {
  const attributes = { ...baseAttributes(analysis), ...(partial.attributes ?? {}) };
  return {
    clientId: newClientId(),
    title: clip(partial.title, 240),
    summary: clip(partial.summary, 800),
    body: clip(partial.body, 12000),
    attributes,
    claims: mergeClaimsWithAttributeFallback(partial.claims, attributes),
    provenance: {
      ...source,
      citation: source.citation ?? (clip(analysis.title, 200) || undefined),
    },
    applicability: { ...EMPTY_APPLICABILITY },
    selected: true,
  };
}

/** Build 1–8 distinct candidates from extractor output (document = source, not one row).
 * Cap is intentional UX for human review — not a hard system limit. Re-run intake or
 * split the source if a document yields more than eight durable insights. */
export function proposalsFromDocAnalysis(
  analysis: DocAnalysePayload,
  source: KnowledgeSourceProvenance
): ProposedKnowledgeCandidate[] {
  const fromModel = (analysis.knowledge_proposals ?? [])
    .map((p) =>
      p.title?.trim()
        ? proposalRow(
            {
              title: p.title,
              summary: p.summary ?? undefined,
              body: p.body ?? undefined,
              attributes: p.attributes,
              claims: p.claims,
            },
            source,
            analysis
          )
        : null
    )
    .filter(Boolean) as ProposedKnowledgeCandidate[];

  if (fromModel.length > 0) {
    return fromModel.slice(0, 8);
  }

  const out: ProposedKnowledgeCandidate[] = [];
  const mainTitle =
    clip(analysis.title, 240) ||
    clip(source.source_document, 240) ||
    clip(source.source_url, 240) ||
    "Untitled knowledge";

  const mainSummary =
    clip(analysis.summary, 800) ||
    [analysis.document_type, analysis.outcome].filter(Boolean).join(" · ");

  const mainBody =
    clip(analysis.ocr_text, 12000) ||
    (analysis.findings?.length ? analysis.findings.join("\n\n") : "");

  if (mainTitle && (mainSummary || mainBody)) {
    out.push(
      proposalRow(
        { title: mainTitle, summary: mainSummary, body: mainBody },
        source,
        analysis
      )
    );
  }

  for (const finding of analysis.findings ?? []) {
    const text = finding.trim();
    if (!text || text.length < 12) continue;
    if (out.some((c) => c.body.includes(text) || c.title === text.slice(0, 80))) continue;
    out.push(
      proposalRow(
        {
          title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
          summary: `From ${source.source_document ?? "source document"}`,
          body: text,
          attributes: { applies_when: "when this condition applies" },
        },
        source,
        analysis
      )
    );
    if (out.length >= 8) break;
  }

  for (const rec of analysis.compliance_recommendations ?? []) {
    const text = rec.trim();
    if (!text || text.length < 12) continue;
    if (out.some((c) => c.body.includes(text))) continue;
    out.push(
      proposalRow(
        {
          title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
          summary: "Recommended action from source",
          body: text,
          attributes: { action: text.slice(0, 500) },
        },
        source,
        analysis
      )
    );
    if (out.length >= 8) break;
  }

  if (out.length === 0 && mainTitle) {
    out.push(
      proposalRow(
        { title: mainTitle, summary: mainSummary, body: mainBody || mainSummary },
        source,
        analysis
      )
    );
  }

  return out.slice(0, 8);
}

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type === "text/csv"
  );
}

export function isKnowledgeDocumentFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  );
}
