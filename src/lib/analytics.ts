/**
 * Product analytics — PostHog.
 *
 * Rules:
 * - Fire events at the data layer (after successful DB writes), never in UI components.
 * - Never send PII: no names, emails, addresses, or document content in properties.
 * - All events are namespaced under the AnalyticsEvent union type — add new events here first.
 * - EU Cloud endpoint used for FADP compliance (data stored in Frankfurt).
 */

import posthog from "posthog-js";

export type AnalyticsEvent =
  | "property_created"
  | "task_created"
  | "ai_task_generated"
  | "compliance_item_completed"
  | "document_uploaded"
  | "issue_flagged"
  | "ai_suggestion_accepted"
  | "ai_suggestion_edited"
  | "ai_suggestion_rejected";

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
  });
}

export function identifyUser(userId: string, orgId: string, orgName: string): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
  posthog.identify(userId, { org_id: orgId, org_name: orgName });
  posthog.group("organisation", orgId, { name: orgName });
}

export function resetAnalyticsUser(): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
  posthog.reset();
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
