/**
 * Frontend catalog of compiled AI capabilities and approved strategies.
 * Source of truth remains `supabase/functions/_shared/aiRouting.ts` — this list
 * exists so the admin UI cannot import Deno edge code. Keep them in lockstep
 * (see routeCatalog.test.ts).
 */

export const AI_CAPABILITY_IDS = [
  "task_extraction",
  "document_analysis",
  "workbook_interpretation",
  "photo_asset_identification",
  "compliance_clause_rewrite",
  "knowledge_critique",
  "knowledge_guidance_draft",
  "knowledge_claim_extract",
  "knowledge_evidence_pack",
  "knowledge_gap_research",
  "plan_label_extraction",
  "content_seo_draft",
  "content_brief_draft",
  "content_output_draft",
  "content_output_grounding",
  "content_visual_brief",
] as const;

export type AiCapabilityId = (typeof AI_CAPABILITY_IDS)[number];

export const AI_STRATEGY_IDS = [
  "model:gemini-2.0-flash",
  "model:gpt-4o-mini",
  "model:google/gemini-2.0-flash",
  "deterministic:rule-based-task",
  "deterministic:pdf-text",
] as const;

export type AiStrategyId = (typeof AI_STRATEGY_IDS)[number];

export const AI_CAPABILITY_META: Record<
  AiCapabilityId,
  { label: string; compiledPrimary: AiStrategyId; functionName: string }
> = {
  task_extraction: {
    label: "Task extraction",
    compiledPrimary: "model:google/gemini-2.0-flash",
    functionName: "ai-extract",
  },
  document_analysis: {
    label: "Document analysis",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "ai-doc-analyse",
  },
  workbook_interpretation: {
    label: "Workbook interpretation",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "ai-doc-analyse",
  },
  photo_asset_identification: {
    label: "Photo asset identification",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "ai-image-analyse",
  },
  compliance_clause_rewrite: {
    label: "Compliance clause rewrite",
    compiledPrimary: "model:google/gemini-2.0-flash",
    functionName: "compliance-clause-rewrite",
  },
  knowledge_critique: {
    label: "Knowledge critic",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "knowledge-critic",
  },
  knowledge_guidance_draft: {
    label: "Knowledge guidance draft",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "knowledge-generate-guidance",
  },
  knowledge_claim_extract: {
    label: "Knowledge claim extraction",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "knowledge-extract-claims",
  },
  knowledge_evidence_pack: {
    label: "Knowledge evidence pack",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "knowledge-evidence-pack",
  },
  knowledge_gap_research: {
    label: "Knowledge gap source research",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "knowledge-gap-research",
  },
  plan_label_extraction: {
    label: "Plan label extraction",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "building-plan-process",
  },
  content_seo_draft: {
    label: "Content SEO draft",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "content-generate",
  },
  content_brief_draft: {
    label: "Content brief draft",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "content-generate",
  },
  content_output_draft: {
    label: "Content output draft",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "content-generate",
  },
  content_output_grounding: {
    label: "Content output grounding critic",
    compiledPrimary: "model:gpt-4o-mini",
    functionName: "content-generate",
  },
  content_visual_brief: {
    label: "Content visual brief",
    compiledPrimary: "model:gemini-2.0-flash",
    functionName: "content-generate",
  },
};

export function isAiCapabilityId(value: string): value is AiCapabilityId {
  return (AI_CAPABILITY_IDS as readonly string[]).includes(value);
}

export function isAiStrategyId(value: string): value is AiStrategyId {
  return (AI_STRATEGY_IDS as readonly string[]).includes(value);
}
