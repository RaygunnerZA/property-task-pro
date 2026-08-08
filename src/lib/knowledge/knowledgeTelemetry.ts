/**
 * Knowledge product analytics — fire from mutation/data layers only.
 * No PII: no titles, bodies, or document content.
 */
import { track } from "@/lib/analytics";

export function trackKnowledgeCreated(props: {
  org_id: string | null;
  knowledge_id: string;
  scope: string;
  source_kind: string;
}): void {
  track("knowledge_created", props);
}

export function trackKnowledgeVerified(props: {
  org_id: string | null;
  knowledge_id: string;
  scope: string;
}): void {
  track("knowledge_verified", props);
}

export function trackKnowledgeReused(props: {
  org_id: string;
  knowledge_id?: string | null;
  via: "assistant" | "link" | "page";
}): void {
  track("knowledge_reused", props);
}

export function trackKnowledgeQuestionAnswered(props: {
  org_id: string;
  cited_count: number;
}): void {
  track("knowledge_question_answered", props);
}

export function trackKnowledgeAutomationCreated(props: {
  org_id: string;
  knowledge_id: string;
}): void {
  track("knowledge_automation_created", props);
}

export function trackKnowledgeTimeSaved(props: {
  org_id: string;
  estimated_minutes: number;
  via: string;
}): void {
  track("knowledge_time_saved", props);
}
