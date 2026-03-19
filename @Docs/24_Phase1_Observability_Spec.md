# CHAPTER 24 — PHASE 1: OBSERVABILITY SPEC

**Status:** Approved for implementation  
**Depends on:** Nothing (purely additive)  
**Risk level:** Low — no changes to existing tables or RLS policies until noted  
**Touches:** `supabase/migrations/`, `supabase/functions/`, `src/`, `package.json`

---

## 24.0 — Context and What Already Exists

Before listing what to build, record what is already in place to avoid re-implementing it.

| Concern | Status |
|---|---|
| AI calls wrapped in edge functions (not called from UI) | Done — 22 edge functions |
| `audit_logs` table with org scoping | Done |
| `ai_resolution_audit` (suggestion vs. chosen) | Exists but has broken RLS and is not in generated types |
| `assistant_logs` (assistant action audit) | Done |
| `compliance_history` (per-document events) | Done |
| External analytics SDK | Not present |
| Per-request AI cost/latency/model tracking | Not present |
| Shared edge function utility | Not present — no `_shared/` folder |

Phase 1 closes three real gaps:

1. **AI request observability** — a new `ai_requests` table and a shared edge function utility that writes to it
2. **Known bug fixes** — two bugs that should be fixed before any new code depends on the same infrastructure
3. **External product analytics** — PostHog SDK installed and 7 core events wired

---

## 24.1 — Known Bugs to Fix First

These must ship as the first migration and PR in this phase. They are blocking further work.

### Bug 1: `ai_resolution_audit` RLS references wrong table

**Location:** `supabase/migrations/20260107000001_create_ai_resolution_audit.sql`

The original migration wrote `FROM org_members` in its RLS policies. The correct table is `organisation_members`. As a result, every INSERT into `ai_resolution_audit` from `src/services/ai/resolutionAudit.ts` silently fails in production — RLS blocks the write, no error is surfaced because failures are swallowed in `logResolutionAudit()`.

**Fix:** New migration that drops and recreates the RLS policies with the correct table name.

```sql
-- Migration: fix_ai_resolution_audit_rls.sql
DROP POLICY IF EXISTS "ai_resolution_audit_select" ON ai_resolution_audit;
DROP POLICY IF EXISTS "ai_resolution_audit_insert" ON ai_resolution_audit;

CREATE POLICY "ai_resolution_audit_select" ON ai_resolution_audit
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_resolution_audit_insert" ON ai_resolution_audit
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );
```

**Also required:** Regenerate Supabase types after this migration runs. `ai_resolution_audit` and `ai_resolution_memory` are absent from `src/integrations/supabase/types.ts`. All calls to these tables from `src/services/ai/resolutionAudit.ts` and `resolutionMemory.ts` bypass TypeScript safety.

### Bug 2: Debug telemetry leak in `assistant-reasoner`

**Location:** `supabase/functions/assistant-reasoner/index.ts` — two `fetch()` calls to `http://127.0.0.1:7242/ingest/8c0e792f-...`

This is a hardcoded local debug server address that runs in the production edge function on every request. It fails silently (the local server is not running in production), but it is a dead network call on the hot path of every assistant query, and it leaks the internal debug server port and key into the deployed function code.

**Fix:** Remove both `fetch()` calls to `127.0.0.1:7242`. Replace with `console.log()` behind a `Deno.env.get('DEBUG_LOGGING') === 'true'` guard if the telemetry is still needed for local development.

---

## 24.2 — New Table: `ai_requests`

This is a new append-only table. It is distinct from `ai_resolution_audit`:

- `ai_resolution_audit` — records what the AI *suggested* vs. what the *user chose* (a UX-level concept)
- `ai_requests` — records every AI provider call (a infrastructure-level concept: model, cost, latency)

These are different concerns and should remain separate tables.

### Schema

```sql
CREATE TABLE ai_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name   TEXT        NOT NULL,
  model_used      TEXT        NOT NULL,
  provider        TEXT        NOT NULL,
  prompt_version  TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(12, 8),
  latency_ms      INTEGER,
  status          TEXT        NOT NULL DEFAULT 'success'
                  CHECK (status IN ('success', 'error', 'timeout', 'fallback')),
  error_message   TEXT,
  entity_type     TEXT,
  entity_id       UUID,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_requests_org_id_idx        ON ai_requests (org_id);
CREATE INDEX ai_requests_created_at_idx    ON ai_requests (created_at DESC);
CREATE INDEX ai_requests_function_name_idx ON ai_requests (function_name);
CREATE INDEX ai_requests_entity_idx        ON ai_requests (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's AI requests
CREATE POLICY "ai_requests_select" ON ai_requests
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- Only service role can insert (edge functions use service role key)
-- No INSERT policy for authenticated users
-- No UPDATE or DELETE policy (append-only)
```

### Field Definitions

| Field | Description |
|---|---|
| `function_name` | Supabase edge function name: `'ai-extract'`, `'ai-doc-analyse'`, `'ai-image-analyse'`, etc. |
| `model_used` | Exact model identifier: `'gemini-2.0-flash'`, `'gpt-4o-mini'` |
| `provider` | Provider key: `'GEMINI'`, `'OPENAI'`, `'LOVABLE'` |
| `prompt_version` | Version string for the prompt template used. `null` until prompt versioning is in place. Use `'v1'` as default once versioning is added. |
| `input_tokens` | Tokens in the prompt. Derived from the provider response where available. |
| `output_tokens` | Tokens in the completion. Derived from provider response. |
| `cost_usd` | Calculated at log time using the token counts and the cost table in §24.3. |
| `latency_ms` | Wall-clock time from the start of the provider `fetch()` to response completion. |
| `status` | `'success'` on 2xx; `'timeout'` on AbortController timeout; `'error'` on provider non-2xx; `'fallback'` when a secondary provider was used after a primary failure. |
| `entity_type` | The domain entity this AI call was about: `'compliance_document'`, `'attachment'`, `'task'`, `'asset'`. `null` for general calls. |
| `entity_id` | The UUID of the entity, if applicable. |

### Cost Reference Table (embedded in shared utility — not a DB table)

These are current list prices. Update the utility when pricing changes.

```typescript
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash':        { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro':          { input: 0.00125,  output: 0.005  },
  'gpt-4o-mini':             { input: 0.00015,  output: 0.0006 },
  'gpt-4o':                  { input: 0.0025,   output: 0.01   },
  'google/gemini-2.0-flash': { input: 0.000075, output: 0.0003 }, // Lovable gateway routes here
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates || !inputTokens || !outputTokens) return null;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}
```

---

## 24.3 — Shared Edge Function Utility: `_shared/aiObservability.ts`

Currently there is no `_shared/` folder. Create `supabase/functions/_shared/aiObservability.ts`.

Supabase edge functions can import from sibling paths using relative imports. The `_shared/` convention is the standard Supabase pattern for utilities that are used across multiple functions.

### Interface

```typescript
export interface AiRequestLog {
  org_id: string;
  user_id?: string | null;
  function_name: string;
  model_used: string;
  provider: string;
  prompt_version?: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  status: 'success' | 'error' | 'timeout' | 'fallback';
  error_message?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAiRequest(
  supabaseServiceClient: SupabaseClient,
  log: AiRequestLog
): Promise<void> {
  // Non-blocking: do not await and do not throw
  supabaseServiceClient
    .from('ai_requests')
    .insert(log)
    .then(({ error }) => {
      if (error) console.error('[aiObservability] Failed to log ai_request:', error.message);
    });
}
```

### Usage Pattern in Edge Functions

The pattern for any edge function that makes an AI provider call:

```typescript
import { logAiRequest } from '../_shared/aiObservability.ts';

const start = Date.now();
let status: 'success' | 'error' | 'timeout' | 'fallback' = 'success';
let errorMessage: string | null = null;
let inputTokens: number | null = null;
let outputTokens: number | null = null;

try {
  const response = await fetch(providerUrl, { ... });
  const json = await response.json();

  // Extract token usage where available
  inputTokens = json.usageMetadata?.promptTokenCount ?? null;
  outputTokens = json.usageMetadata?.candidatesTokenCount ?? null;

  if (!response.ok) {
    status = 'error';
    errorMessage = `HTTP ${response.status}`;
  }
} catch (err) {
  status = err.name === 'AbortError' ? 'timeout' : 'error';
  errorMessage = String(err);
} finally {
  const latency = Date.now() - start;
  await logAiRequest(supabase, {
    org_id,
    function_name: 'ai-extract',
    model_used: 'gemini-2.0-flash',
    provider: 'LOVABLE',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: estimateCost('gemini-2.0-flash', inputTokens ?? 0, outputTokens ?? 0),
    latency_ms: latency,
    status,
    error_message: errorMessage,
    entity_type: 'task',
    entity_id: null,
  });
}
```

### Token Extraction by Provider

Different providers return token counts in different response shapes:

| Provider | Input tokens | Output tokens |
|---|---|---|
| Gemini (direct) | `response.usageMetadata.promptTokenCount` | `response.usageMetadata.candidatesTokenCount` |
| OpenAI | `response.usage.prompt_tokens` | `response.usage.completion_tokens` |
| Lovable gateway | Same as Gemini (proxies Gemini response format) |

---

## 24.4 — Edge Function Rollout Order

Do not update all 22 functions at once. Rollout in priority order by call volume and risk:

**Batch 1 — High volume, high cost (ship first):**

| Function | entity_type | entity_id source |
|---|---|---|
| `ai-extract` | `'task'` | `null` (not entity-bound) |
| `ai-doc-analyse` | `'compliance_document'` | `body.compliance_document_id` |
| `ai-image-analyse` | `'attachment'` | `body.attachment_id` |

**Batch 2 — Medium volume:**

| Function | entity_type | entity_id source |
|---|---|---|
| `assistant-reasoner` | `null` | `null` |
| `assistant-action-executor` | `'task'` or `'compliance_document'` | payload |
| `filla-brain-infer` | `null` | `null` (cross-org, no entity) |
| `ai-doc-reanalyse` | `'compliance_document'` | body |

**Batch 3 — Low volume (AI-powered creation flows):**

- `ai-actions-create-compliance`
- `ai-actions-create-asset`

**Batch 4 — Infrastructure (no AI provider calls, skip):**

- `graph-sync`, `graph-query`, `graph-insight`, `compliance-auto-engine`, `compliance-scheduler`, `optimize-image`, `process-image`, `invite-team-member`, `manage-invited-users`, `building-plan-process`, `brain-train`, `local-to-global-extractor`, `seed-property`

---

## 24.5 — PostHog Integration

### SDK and Configuration

Install `posthog-js` in the frontend. Use the EU Cloud endpoint for Swiss FADP compliance (data stored in Frankfurt, not the US).

```
npm install posthog-js
```

**Configuration:**

```typescript
// src/lib/analytics.ts
import posthog from 'posthog-js';

export function initAnalytics() {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,       // manual control
      capture_pageleave: false,
      autocapture: false,            // explicit events only
      disable_session_recording: true, // enable separately once FADP review done
    });
  }
}

export function identifyUser(userId: string, orgId: string, orgName: string) {
  posthog.identify(userId, {
    org_id: orgId,
    org_name: orgName,
  });
  posthog.group('organisation', orgId, { name: orgName });
}

export function resetAnalyticsUser() {
  posthog.reset();
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export type AnalyticsEvent =
  | 'property_created'
  | 'task_created'
  | 'ai_task_generated'
  | 'compliance_item_completed'
  | 'document_uploaded'
  | 'issue_flagged'
  | 'ai_suggestion_accepted'
  | 'ai_suggestion_edited'
  | 'ai_suggestion_rejected';
```

**Environment variable required:**

```
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxx
```

This must be added to `.env.local` for development and to Vercel environment variables for production. The key is public (not a secret — PostHog keys are designed to be in frontend code). Add it to Cursor Secrets if using cloud agents.

### Initialisation

Call `initAnalytics()` once in the app entry point, and `identifyUser()` after session hydration completes (after the org gate resolves).

```typescript
// src/App.tsx — after auth + org context resolves
useEffect(() => {
  if (user && activeOrg) {
    identifyUser(user.id, activeOrg.id, activeOrg.name);
  }
}, [user?.id, activeOrg?.id]);
```

Call `resetAnalyticsUser()` on sign-out.

### Core Events — Where to Fire Them

Do not scatter `track()` calls throughout the codebase. Fire events at the data mutation layer (React Query mutation `onSuccess` callbacks), not in UI components.

| Event | Fire location | Properties |
|---|---|---|
| `property_created` | `useCreateProperty` mutation `onSuccess` | `{ org_id, property_id }` |
| `task_created` | `useCreateTask` mutation `onSuccess` | `{ org_id, task_id, source: 'manual' \| 'ai' \| 'assistant' }` |
| `ai_task_generated` | `ai-extract` response handler in `AssistantContext` | `{ org_id, chip_count, confidence_avg }` |
| `compliance_item_completed` | `useUpdateComplianceStatus` mutation `onSuccess` | `{ org_id, document_id, document_type }` |
| `document_uploaded` | `useUploadAttachment` or inbox upload `onSuccess` | `{ org_id, document_type, via_ai: boolean }` |
| `issue_flagged` | Issue creation mutation `onSuccess` | `{ org_id, property_id }` |
| `ai_suggestion_accepted` | `logResolutionAudit` call path | `{ org_id, suggestion_type }` |
| `ai_suggestion_edited` | `logResolutionAudit` call path | `{ org_id, suggestion_type }` |
| `ai_suggestion_rejected` | `logResolutionAudit` call path | `{ org_id, suggestion_type }` |

**Do not send:** user names, emails, property addresses, document content, or any PII in event properties.

### Privacy and FADP

- `autocapture: false` ensures PostHog does not automatically collect DOM content or URLs that could contain property addresses or document names.
- `person_profiles: 'identified_only'` ensures anonymous visitors are not profiled.
- PostHog EU Cloud is covered under EU Standard Contractual Clauses. For Swiss FADP, the Swiss DPA has confirmed SCCs are an adequate transfer mechanism.
- Add PostHog to the privacy policy as a data processor before going live with analytics.

---

## 24.6 — Unified Event Emission Pattern (Audit Logs)

The four existing log tables are not being replaced. The problem is consistency: edge functions each have their own write patterns and some do not write to `audit_logs` at all.

The goal is: any significant AI or system event that an admin or user might want to trace should appear in `audit_logs` with a structured `action` string.

### Naming Convention for `action`

Use dot-separated domain.verb format. This is an extension of the existing convention (existing entries use strings like `task_completed`, `document_deleted`).

New events from edge functions should use:

```
ai.extract.completed
ai.doc.analysed
ai.image.analysed
ai.doc.reanalysed
assistant.action.executed
compliance.scheduled
```

### `audit_logs` INSERT from Edge Functions

Edge functions use the service role key and can bypass RLS. Insert directly:

```typescript
await supabase.from('audit_logs').insert({
  org_id,
  actor_id: userId ?? null,
  entity_type: 'compliance_document',
  entity_id: complianceDocumentId,
  action: 'ai.doc.analysed',
  metadata: {
    model: 'gemini-2.0-flash',
    confidence: result.confidence,
    document_type: result.document_type,
  },
});
```

This is a secondary log. The primary observability record lives in `ai_requests`. The `audit_logs` entry is for the domain-level event (what happened to the entity), while `ai_requests` is for the infrastructure-level event (how the AI call performed).

---

## 24.7 — Deliverables Checklist

### Database (new migration file per item)

- [ ] `fix_ai_resolution_audit_rls.sql` — corrects `org_members` → `organisation_members`
- [ ] `create_ai_requests.sql` — new table with full DDL and RLS as defined in §24.2

### Edge Functions

- [ ] `supabase/functions/_shared/aiObservability.ts` — new shared utility
- [ ] `ai-extract` updated (Batch 1)
- [ ] `ai-doc-analyse` updated (Batch 1)
- [ ] `ai-image-analyse` updated (Batch 1)
- [ ] Debug telemetry removed from `assistant-reasoner`
- [ ] Batch 2 functions updated (after Batch 1 is verified in production)
- [ ] Batch 3 functions updated (after Batch 2 verified)

### Frontend

- [ ] `posthog-js` installed
- [ ] `src/lib/analytics.ts` created
- [ ] `initAnalytics()` called in app entry point
- [ ] `identifyUser()` wired to auth/org context
- [ ] `resetAnalyticsUser()` called on sign-out
- [ ] 9 core events wired to mutation `onSuccess` callbacks (§24.5)
- [ ] `VITE_POSTHOG_KEY` added to Vercel env + `.env.local.example`

### Types

- [ ] Supabase types regenerated after migrations run (`supabase gen types typescript`)
- [ ] `ai_requests` appears in `src/integrations/supabase/types.ts`
- [ ] `ai_resolution_audit` appears in `src/integrations/supabase/types.ts`
- [ ] `ai_resolution_memory` appears in `src/integrations/supabase/types.ts`

### Docs

- [ ] `@Docs/03_Data_Model.md` updated to include `ai_requests`

---

## 24.8 — What This Phase Does Not Include

To be explicit about scope boundaries:

- No model routing or fallback logic (Phase 3)
- No prompt versioning system (Phase 3)
- No AI request viewer in the UI (Phase 2 — admin panel)
- No cost dashboard (Phase 4)
- No changes to `ai_resolution_audit` schema (its RLS is fixed, not its columns)
- No changes to any existing RLS policies beyond the audit table fix
- No impersonation
- No data override tooling
