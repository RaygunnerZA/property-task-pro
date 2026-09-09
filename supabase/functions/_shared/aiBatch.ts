/**
 * Durable AI batch jobs — parse/validate only (no Deno).
 * Delivery mode for approved capabilities; not a new capability.
 * Gemini Batch is ~50% of interactive token price. Never batch verify/publish.
 */

import { SchemaError } from "./aiRouting.ts";
import {
  MAX_RESEARCH_GAPS,
  parseResearchGapsBody,
  type ResearchGapInput,
} from "./knowledgeGapResearch.ts";

export const MAX_GUIDANCE_BATCH_ITEMS = 80;
export const MAX_CONTENT_BATCH_ITEMS = 20;
export const BATCH_PRICE_MULTIPLIER = 0.5;

export const AI_BATCH_CAPABILITIES = [
  "knowledge_guidance_draft",
  "knowledge_gap_research",
  "content_seo_draft",
  "content_brief_draft",
  "content_output_draft",
  "content_visual_brief",
] as const;

export type AiBatchCapability = (typeof AI_BATCH_CAPABILITIES)[number];

/** Capabilities the submit function will enqueue today. Content is accepted in the union for later wiring. */
export const AI_BATCH_ENABLED_CAPABILITIES = [
  "knowledge_guidance_draft",
  "knowledge_gap_research",
] as const satisfies ReadonlyArray<AiBatchCapability>;

export type AiBatchEnabledCapability = (typeof AI_BATCH_ENABLED_CAPABILITIES)[number];

export const AI_BATCH_MODES = [
  "generate",
  "improve",
  "research",
  "seo",
  "brief",
  "output",
  "visual_brief",
] as const;

export type AiBatchMode = (typeof AI_BATCH_MODES)[number];

export const AI_BATCH_OPEN_STATUSES = [
  "queued",
  "submitted",
  "running",
  "intake_pending",
] as const;

export type AiBatchOpenStatus = (typeof AI_BATCH_OPEN_STATUSES)[number];

export const AI_BATCH_TERMINAL_STATUSES = ["succeeded", "failed", "cancelled"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function isAiBatchCapability(value: unknown): value is AiBatchCapability {
  return (
    typeof value === "string" &&
    (AI_BATCH_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function isAiBatchCapabilityEnabled(capability: AiBatchCapability): boolean {
  return (AI_BATCH_ENABLED_CAPABILITIES as readonly string[]).includes(capability);
}

export function isAiBatchMode(value: unknown): value is AiBatchMode {
  return typeof value === "string" && (AI_BATCH_MODES as readonly string[]).includes(value);
}

export type GuidanceBatchItem = { knowledge_id: string };
export type ResearchBatchItem = ResearchGapInput;
export type ContentBatchItem = {
  topic_id: string;
  output_kinds?: string[];
  regenerate?: boolean;
};

export type ParsedAiBatchSubmit =
  | {
      capability: "knowledge_guidance_draft";
      mode: "generate" | "improve";
      items: GuidanceBatchItem[];
    }
  | {
      capability: "knowledge_gap_research";
      mode: "research";
      items: ResearchBatchItem[];
    }
  | {
      capability: "content_seo_draft" | "content_brief_draft" | "content_output_draft" | "content_visual_brief";
      mode: "seo" | "brief" | "output" | "visual_brief";
      items: ContentBatchItem[];
    };

function uniqueUuids(raw: unknown[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (!isUuid(value)) continue;
    const id = value.trim().toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length > cap) break;
  }
  return out;
}

/**
 * Parse submit body. Does not authorise.
 * Content capabilities parse successfully so the union stays stable; the Edge
 * Function returns 501 until the content processor is wired.
 */
export function parseAiBatchSubmitBody(body: unknown): ParsedAiBatchSubmit {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SchemaError("body_not_object");
  }
  const rec = body as Record<string, unknown>;
  if (!isAiBatchCapability(rec.capability)) {
    throw new SchemaError("capability_invalid");
  }
  const capability = rec.capability;

  if (capability === "knowledge_guidance_draft") {
    const mode = rec.mode === "improve" ? "improve" : rec.mode === "generate" || rec.mode == null ? "generate" : null;
    if (!mode) throw new SchemaError("mode_invalid");
    const ids = uniqueUuids(
      [
        ...(isUuid(rec.knowledge_id) ? [rec.knowledge_id] : []),
        ...(Array.isArray(rec.knowledge_ids) ? rec.knowledge_ids : []),
        ...(Array.isArray(rec.items)
          ? rec.items.map((item) =>
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as { knowledge_id?: unknown }).knowledge_id
                : item
            )
          : []),
      ],
      MAX_GUIDANCE_BATCH_ITEMS + 1
    );
    if (ids.length === 0) throw new SchemaError("knowledge_ids_required");
    if (ids.length > MAX_GUIDANCE_BATCH_ITEMS) throw new SchemaError("too_many_items");
    return {
      capability,
      mode,
      items: ids.map((knowledge_id) => ({ knowledge_id })),
    };
  }

  if (capability === "knowledge_gap_research") {
    if (rec.mode != null && rec.mode !== "research") throw new SchemaError("mode_invalid");
    const gaps = parseResearchGapsBody({
      gaps: Array.isArray(rec.gaps)
        ? rec.gaps
        : Array.isArray(rec.items)
          ? rec.items
          : rec.gaps,
    });
    if (gaps.length > MAX_RESEARCH_GAPS) throw new SchemaError("too_many_items");
    return { capability, mode: "research", items: gaps };
  }

  const rawItems = Array.isArray(rec.items) ? rec.items : [];
  const topicFromRoot = isUuid(rec.topic_id) ? rec.topic_id.trim().toLowerCase() : null;
  const items: ContentBatchItem[] = [];
  const seen = new Set<string>();
  const pushTopic = (topic_id: string, extra?: { output_kinds?: string[]; regenerate?: boolean }) => {
    if (seen.has(topic_id)) return;
    seen.add(topic_id);
    items.push({ topic_id, ...extra });
  };
  if (topicFromRoot) {
    pushTopic(topicFromRoot, {
      output_kinds: Array.isArray(rec.output_kinds)
        ? rec.output_kinds.filter((k): k is string => typeof k === "string").slice(0, 8)
        : undefined,
      regenerate: rec.regenerate === true,
    });
  }
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    if (!isUuid(row.topic_id)) continue;
    pushTopic(row.topic_id.trim().toLowerCase(), {
      output_kinds: Array.isArray(row.output_kinds)
        ? row.output_kinds.filter((k): k is string => typeof k === "string").slice(0, 8)
        : undefined,
      regenerate: row.regenerate === true,
    });
    if (items.length > MAX_CONTENT_BATCH_ITEMS) throw new SchemaError("too_many_items");
  }
  const expected =
    capability === "content_seo_draft"
      ? "seo"
      : capability === "content_brief_draft"
        ? "brief"
        : capability === "content_output_draft"
          ? "output"
          : "visual_brief";
  if (rec.mode != null && rec.mode !== expected) throw new SchemaError("mode_invalid");
  if (items.length === 0) throw new SchemaError("topic_ids_required");
  if (items.length > MAX_CONTENT_BATCH_ITEMS) throw new SchemaError("too_many_items");
  return {
    capability,
    mode: expected,
    items,
  };
}

export function itemIdsJson(parsed: ParsedAiBatchSubmit): unknown[] {
  if (parsed.capability === "knowledge_guidance_draft") {
    return parsed.items.map((item) => item.knowledge_id);
  }
  if (parsed.capability === "knowledge_gap_research") {
    return parsed.items;
  }
  return parsed.items;
}

export function contentStageToBatchCapability(
  stage: string
): Extract<
  AiBatchCapability,
  "content_seo_draft" | "content_brief_draft" | "content_output_draft" | "content_visual_brief"
> | null {
  switch (stage) {
    case "seo":
      return "content_seo_draft";
    case "brief":
      return "content_brief_draft";
    case "output":
      return "content_output_draft";
    case "visual_concept":
    case "visual_brief":
      return "content_visual_brief";
    default:
      return null;
  }
}
