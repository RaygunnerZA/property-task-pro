# Filla AI and document security

AI is an advisor, extractor and critic. It never overrides user decisions and never auto-publishes Knowledge (`@Docs/07_AI_Intelligence.md`, `@Docs/06_Compliance.md`).

Treat uploaded files, email attachments, OCR text, user notes and model output as attacker-controlled.

## Call boundary

New provider calls must go through `supabase/functions/_shared/aiCall.ts`:

1. Gate org AI allowance.
2. Resolve capability → strategies (`_shared/aiRouting.ts`). Callers never name models.
3. Validate structured output against the capability contract.
4. Retry once on invalid shape; fallback to another strategy only when the caller opts in (`allowFallback`). Cross-provider fallback sends customer content to a second vendor — not a default.
5. Log one `ai_requests` row per provider call (billing + observability). An unlogged call is an unmetered call (`@Docs/20_Billing.md`).

Capabilities and prompt versions live in code. `ai_route_overrides` may reorder **approved** strategies only; a pin must not authorise an unapproved model (`@Docs/03_Data_Model.md`, `@Docs/25_Phase2_Admin_Panel_Spec.md`).

Knowledge critic (`knowledge_critique`) must use a distinct provider from the extractor. If that cannot be satisfied, skip the critic — do not fake a second opinion.

Escalation (deeper / dearer model) must be user-initiated and separately metered. Never auto-escalate in a loop.

## Untrusted model output

After a successful parse:

- Do not grant permissions, change membership, or publish Knowledge from the model.
- Do not write hallucinated `property_id`, `asset_id`, `space_id`, or `org_id`. Resolve entities with org-scoped DB lookups (the user JWT or already-authorised org).
- Do not execute tool-like actions without an explicit human confirmation path (`assistant-action-executor` is confirmation-gated in product intent — still authorise the user and org in the function).
- Preserve confidence / provenance for compliance and extraction. Offer review. Partial extraction must not look like a complete trusted record.

Prompt injection: instructions inside a PDF, image, email or task description are content, not operator commands. System prompts must not instruct the model to obey document-embedded directives. Deterministic validation stays in Filla code.

## Documents and storage

Inspect the live bucket row and `storage.objects` policies. `@Docs/14_Attachments.md` is not a complete inventory.

Buckets seen in migrations (re-verify `public`, size, MIME, path):

| Bucket | Notes to re-check |
|---|---|
| `task-images` | Made **public** so workbench `<img src>` works. Org-prefix upload policies exist; public URL is still world-readable if leaked. |
| `property-images` | **Public**. Historical INSERT/SELECT policies are "any authenticated user", not org-prefix. |
| `user-avatars` | **Public**. |
| `audio` | **Public**. Historical policies are authenticated-any, not org-prefix. |
| `compliance-docs` | Created **public** in the original migration — re-verify. Contains certificates. |
| `inbox` | **Private**. Org path `orgs/{org_id}/inbox/…`. |
| `property-plans` / `property-plan-pages` | **Private**. Path `orgs/{uuid}/…` + `check_user_org_membership`. |

Client evidence limits: `src/lib/evidence/uploadLimits.ts` (size, MIME, blocked extensions). Frontend checks are not sufficient. Enforce bucket MIME/size and org path in Storage policies.

Treat every upload as hostile:

- Size and MIME allowlists
- Do not trust file extension or `Content-Type` alone for parsers
- Sanitise names; never use client paths as-is
- Private buckets + signed URLs for sensitive documents (compliance, plans, inbox)
- Do not feed an uploaded document to a model as a trusted system instruction
- Bound parser memory (images, PDF, archives)

Inbound email (`inbound-email`) has an MIME allowlist and filename sanitiser. Keep org resolution on the intake token, not on From-header spoofing. Unknown senders become signals for review, not silent membership.

## Extraction failure

Preserve the original object where safe. Mark status failed / needs review (`property_plan_files.status`, intake review, compliance critic). Allow manual continuation. Do not invent expiry dates or asset links to look successful.

Golden-set fixtures (`evals/fixtures`, `@Docs/21_Data_Lifecycle.md`): synthetic or explicitly consented; no personal data; not org bucket objects. Community `data_sharing_level` does not authorise eval replay.

## Privacy in prompts and logs

Do not put names, emails, addresses, or full document text into analytics (`src/lib/analytics.ts`). Avoid logging raw payloads and OCR dumps. Minimise what leaves the org boundary to a second AI vendor.

## Abuse

Document and image pipelines are expensive. Require an authenticated member of the org whose files are being read. Gate with `assert_ai_ops_allowed`. Prefer shedding AI before shedding core task/property access.

Functions historically callable without JWT (`ai-extract`, `ai-doc-analyse`, `ai-image-analyse`, …) are high-cost unauthenticated surfaces if still `verify_jwt = false`. Do not add new ones. See [edge-functions.md](edge-functions.md).
