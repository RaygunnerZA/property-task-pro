# Filla resilience and failure modes

For every important integration: what happens when it stops working?

Security-relevant failure (authn, authz, tenant checks) **fails closed**.
Non-security enrichment (geocoding, weather, optional AI assist) may **fail soft**.
Never masquerade failure as success.

## Authentication / authorisation unavailable

If `getUser`, membership lookup, or entitlement RPCs error or time out: deny the privileged action.

Do not grant access because the permission system is slow or ambiguous.

Contrast: product UX may retry reads; it must not retry mutating admin operations without idempotency.

## Database / Supabase

- Do not invent successful writes.
- Show a recoverable error.
- Retries must be idempotent (stable keys, upserts, or "already exists" handling).
- Multi-table actions need a transaction or explicit compensating state (invitation sent vs membership created vs email delivered).

`emit_signal()` is designed to be idempotent on `dedupe_key`. Prefer that over duplicate signal rows.

## AI providers

Filla must remain usable without AI.

| Outcome | Product behaviour |
|---|---|
| Success | Assisted workflow, still human-decided |
| Allowance exhausted | Manual / rule-based path; do not pretend AI ran |
| Invalid JSON / schema | Retry once, then next strategy or manual |
| Timeout / outage | Manual workflow; preserve originals |
| Critic cannot use a distinct provider | Skip critic; do not self-review |

Do not fabricate extraction results to preserve the appearance of success.

`runCapability` records attempts and status. Callers should branch on `blocked` vs `ok` vs error.

### Known discrepancy — AI allowance fail-open

`assertAiOpsAllowed` in `_shared/aiEntitlements.ts` currently returns `allowed: true` when the RPC throws or errors ("fail open" so core work is not blocked by a metering outage). That is a **billing and abuse** residual risk, not an authorisation model.

- Do not copy fail-open to membership, RLS, or webhook signature checks.
- If metering is unavailable, prefer degrading AI (skip the model) over unbounded paid inference when you can do so without breaking uploads or task completion.
- Comment in the file: exhausted allowance must not block core task completion or file uploads. That is about product availability, not about skipping authz.

## Document extraction

Preserve the file. Set a failed / uploaded / needs-review status. Let the user continue manually. Partial OCR must not auto-link compliance or assets.

`building-plan-process` writes an allowance-exhausted message onto the plan file and returns `ok: false` with HTTP 200 so fire-and-forget clients do not throw. Callers must read `ok` / `error`, not only HTTP status. Do not treat HTTP 200 as "extraction succeeded".

## External APIs

| Dependency | Failure posture |
|---|---|
| Stripe webhook secrets missing | 503 — do not process |
| Stripe signature invalid | 400 — do not process |
| Stripe event replay | `billing_events` idempotency — 200 duplicate |
| Google Maps / geo / pollen | Soft fail; do not block property save unless the product requires a validated address |
| Resend receiving API | Fallback to webhook body is lossy; do not mark intake fully processed if attachments were skipped |
| PostHog | Analytics must not be on the success path of writes |
| OAuth calendar/drive | Fail closed for connecting; do not store tokens in the browser |

Use explicit timeouts. Retry only safe operations (GET-like, or idempotent POST with a key).

## Email and invitations

States to keep distinct: invitation created, email sent, accepted, expired, revoked.

Do not insert `organisation_members` as if the person had joined merely because an email provider accepted a send, or fail to roll back a send record if membership insert failed.

`invite-team-member` uses the admin API to page `listUsers` when matching email. That is sensitive (user directory). Do not log emails at info level in production paths. Prefer a narrower lookup if one exists.

## Billing

Entitlement checks that cannot run should fail closed for **expansion** (invites, extra properties, extra AI) while keeping **existing** evidence readable (`@Docs/20_Billing.md` — overage must not revoke read of existing files).

Stripe metadata `org_id` is not proof that the caller owns that org; checkout session creation must already have authorised the user as Owner (or equivalent) of that org.

## Load and attacks

Shed AI, document conversion, environmental scanners and graph expansion before shedding authenticated task/property access.

Bound concurrency and payload size on Edge Functions. Do not run unbounded `listUsers` or unfiltered service-role table scans.

## Destructive operations

No `supabase db reset`, production storage wipes, or hard-delete of org data from an agent session unless the user explicitly requested that environment and action.

Prefer archive / soft-delete (`@Docs/21_Data_Lifecycle.md`). Org deletion needs export grace.

## Observability

Useful signals: `audit_logs`, `ai_requests`, `assistant_logs`, `billing_events`, Edge Function logs.

Do not put secrets, full documents, or unnecessary PII in those streams. Admin cross-org reads must themselves be audited.

## What the user should see

| Failure | User-visible | Data |
|---|---|---|
| Permission error | Access denied / not found (do not leak existence of other orgs) | Unchanged |
| DB write error | Explicit failure | Unchanged |
| AI down | Manual path still works | Original file kept |
| Extraction failed | Needs review | Original file kept |
| Invite email failed | Invitation pending/failed, not "joined" | No fake membership |
| Stripe down | Checkout unavailable | No forged entitlement |
