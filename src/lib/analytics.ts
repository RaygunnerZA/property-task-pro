/**
 * Product analytics — PostHog.
 *
 * Rules:
 * - Fire events at the data layer (after successful DB writes), never in UI components.
 * - Never send PII: no names, emails, addresses, or document content in properties.
 * - All events are namespaced under the AnalyticsEvent union type — add new events here first.
 * - EU Cloud endpoint used for FADP compliance (data stored in Frankfurt).
 * - New invocations of the exported `track` helper: document in `@Docs/24_Phase1_Observability_Spec.md` §24.5 and extend `src/lib/__tests__/analyticsTrackInvokers.test.ts`.
 * - PostHog is loaded after first paint (idle) so it stays off the critical path.
 */

type PostHogClient = {
  init: (key: string, options: Record<string, unknown>) => void;
  identify: (userId: string, props?: Record<string, unknown>) => void;
  group: (type: string, id: string, props?: Record<string, unknown>) => void;
  reset: () => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

export type AnalyticsEvent =
  | "property_created"
  | "task_created"
  | "ai_task_generated"
  | "compliance_item_completed"
  | "document_uploaded"
  | "issue_flagged"
  | "ai_suggestion_accepted"
  | "ai_suggestion_edited"
  | "ai_suggestion_rejected"
  | "quota_warned"
  | "quota_blocked"
  | "addon_checkout_started"
  | "upgrade_cta_clicked"
  | "knowledge_created"
  | "knowledge_verified"
  | "knowledge_reused"
  | "knowledge_question_answered"
  | "knowledge_automation_created"
  | "knowledge_time_saved";

let client: PostHogClient | null = null;
let initStarted = false;
let initPromise: Promise<PostHogClient | null> | null = null;

type PendingCall =
  | { kind: "identify"; userId: string; orgId: string; orgName: string }
  | { kind: "reset" }
  | { kind: "track"; event: AnalyticsEvent; properties?: Record<string, unknown> };

const pending: PendingCall[] = [];

function analyticsKey(): string | undefined {
  return import.meta.env.VITE_POSTHOG_KEY as string | undefined;
}

function flushPending(ph: PostHogClient) {
  while (pending.length > 0) {
    const call = pending.shift();
    if (!call) break;
    if (call.kind === "identify") {
      ph.identify(call.userId, { org_id: call.orgId, org_name: call.orgName });
      ph.group("organisation", call.orgId, { name: call.orgName });
    } else if (call.kind === "reset") {
      ph.reset();
    } else {
      ph.capture(call.event, call.properties);
    }
  }
}

async function loadPosthog(): Promise<PostHogClient | null> {
  const key = analyticsKey();
  if (!key) return null;
  if (client) return client;
  if (initPromise) return initPromise;

  initPromise = import("posthog-js")
    .then((mod) => {
      const ph = (mod.default ?? mod) as PostHogClient;
      if (!initStarted) {
        initStarted = true;
        ph.init(key, {
          api_host: "https://eu.i.posthog.com",
          person_profiles: "identified_only",
          capture_pageview: false,
          capture_pageleave: false,
          autocapture: false,
          disable_session_recording: true,
        });
      }
      client = ph;
      flushPending(ph);
      return ph;
    })
    .catch((err) => {
      console.warn("[analytics] PostHog failed to load", err);
      initPromise = null;
      return null;
    });

  return initPromise;
}

function scheduleIdle(run: () => void) {
  if (typeof window === "undefined") {
    run();
    return;
  }
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 2000);
  }
}

/** Kick off PostHog after first paint — safe to call once from App boot. */
export function initAnalytics(): void {
  if (!analyticsKey()) return;
  scheduleIdle(() => {
    void loadPosthog();
  });
}

export function identifyUser(userId: string, orgId: string, orgName: string): void {
  if (!analyticsKey()) return;
  if (client) {
    client.identify(userId, { org_id: orgId, org_name: orgName });
    client.group("organisation", orgId, { name: orgName });
    return;
  }
  pending.push({ kind: "identify", userId, orgId, orgName });
  void loadPosthog();
}

export function resetAnalyticsUser(): void {
  if (!analyticsKey()) return;
  if (client) {
    client.reset();
    return;
  }
  pending.push({ kind: "reset" });
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!analyticsKey()) return;
  if (client) {
    client.capture(event, properties);
    return;
  }
  pending.push({ kind: "track", event, properties });
  void loadPosthog();
}
