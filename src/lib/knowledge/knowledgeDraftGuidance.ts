/**
 * Draft guidance resolution for Knowledge candidates.
 * Precedence: summary/body → action/task → guidance/notes prose → (AI elsewhere) → empty.
 * Never uses row numbers, cell refs, IDs, or URLs as guidance.
 */

import {
  isMeaningfulGuidanceText,
  looksLikeRowNumberOrCellRef,
} from "@/lib/knowledge/knowledgePresentation";

export type DraftGuidanceSource =
  | "summary"
  | "body"
  | "imported_action"
  | "imported_task"
  | "imported_guidance"
  | "imported_notes"
  | "ai"
  | "empty";

export type DraftGuidanceResolution = {
  /** Text to store as knowledge.summary (preferred short draft). */
  summary: string | null;
  /** Optional longer body; usually null when summary is filled from action. */
  body: string | null;
  source: DraftGuidanceSource;
  /** Fields that supported the draft (for provenance). */
  supportedBy: string[];
  isDraft: boolean;
  isEmpty: boolean;
};

function rejectAsGuidance(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  if (looksLikeRowNumberOrCellRef(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^[A-Z]{1,4}-[A-Z0-9-]{3,}$/i.test(t) && t.length < 40 && !/\s/.test(t)) {
    // Bare requirement IDs like PM-UK-TREE-001
    return true;
  }
  return !isMeaningfulGuidanceText(t);
}

function pickMeaningful(
  value: string | null | undefined
): string | null {
  const t = (value ?? "").trim();
  if (rejectAsGuidance(t)) return null;
  return t;
}

export type DraftGuidanceInput = {
  summary?: string | null;
  body?: string | null;
  attributes?: Record<string, string | null | undefined> | null;
};

/**
 * Deterministic draft guidance for import / backfill (no AI).
 */
export function resolveImportedDraftGuidance(
  input: DraftGuidanceInput
): DraftGuidanceResolution {
  const attrs = input.attributes ?? {};
  const summary = pickMeaningful(input.summary);
  if (summary) {
    return {
      summary,
      body: pickMeaningful(input.body),
      source: "summary",
      supportedBy: ["summary"],
      isDraft: false,
      isEmpty: false,
    };
  }

  const body = pickMeaningful(input.body);
  if (body) {
    return {
      summary: body.length <= 420 ? body : `${body.slice(0, 417)}…`,
      body: body.length > 420 ? body : null,
      source: "body",
      supportedBy: ["body"],
      isDraft: false,
      isEmpty: false,
    };
  }

  const action = pickMeaningful(attrs.action ?? attrs.owner_action ?? null);
  if (action) {
    return {
      summary: action,
      body: null,
      source: "imported_action",
      supportedBy: ["attributes.action"],
      isDraft: true,
      isEmpty: false,
    };
  }

  const task = pickMeaningful(attrs.task ?? attrs.task_text ?? null);
  if (task) {
    return {
      summary: task,
      body: null,
      source: "imported_task",
      supportedBy: ["attributes.task"],
      isDraft: true,
      isEmpty: false,
    };
  }

  const guidanceAttr = pickMeaningful(attrs.guidance ?? attrs.guidance_text ?? null);
  if (guidanceAttr) {
    return {
      summary: guidanceAttr,
      body: null,
      source: "imported_guidance",
      supportedBy: ["attributes.guidance"],
      isDraft: true,
      isEmpty: false,
    };
  }

  const notes = pickMeaningful(attrs.notes ?? null);
  if (notes) {
    return {
      summary: notes,
      body: null,
      source: "imported_notes",
      supportedBy: ["attributes.notes"],
      isDraft: true,
      isEmpty: false,
    };
  }

  return {
    summary: null,
    body: null,
    source: "empty",
    supportedBy: [],
    isDraft: false,
    isEmpty: true,
  };
}

export function needsGuidanceGeneration(input: DraftGuidanceInput): boolean {
  return resolveImportedDraftGuidance(input).isEmpty;
}

export type GuidanceDraftProvenance = {
  source: DraftGuidanceSource | "ai";
  proposed_at: string;
  supported_by: string[];
  model?: string | null;
  provider?: string | null;
  unverified: true;
};
