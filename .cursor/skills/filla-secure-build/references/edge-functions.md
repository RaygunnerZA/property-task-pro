# Filla Edge Function security

Re-read `supabase/config.toml`, the function's `index.ts`, and `_shared/` before changing an Edge Function. JWT flags and client patterns differ per function.

## Two facts that are easy to get wrong

1. `verify_jwt = true` only proves a valid Supabase JWT is present. It does **not** prove organisation membership, role, or property access.
2. A service-role client bypasses RLS. After `getUser()`, you must still authorise against `organisation_members` (and property/role rules) **before** privileged reads or writes.

Never trust `org_id`, `user_id`, `role`, or `property_id` from JSON as authorisation.

## Preferred pattern (user-initiated)

1. Reject non-allowed methods; handle CORS preflight.
2. Require `Authorization`. Resolve the user with `auth.getUser(jwt)` (timeout if the call can hang).
3. Parse and schema-validate the body. Treat IDs as untrusted.
4. Authorise: membership + role + resource ownership using the user JWT client **or** an explicit membership query. Fail closed on error or missing row.
5. Only then use a narrowly scoped service-role client for work RLS cannot express (provider calls, metering, webhook fan-in).
6. Bound timeouts. Do not log tokens, keys, or unnecessary PII.
7. Return explicit errors. Do not imply success on partial failure.

`invite-team-member` is a relatively complete example: JWT user, membership + role check, entitlement check, then admin writes. Re-read it; do not copy stale logging of emails if tightening privacy.

`building-plan-process` is a better data-access example: load the plan file with the **user** client so RLS decides visibility, then use admin for processing.

## Anti-patterns (treat as SECURITY BLOCKER if they create a real path)

- Service-role client used for the primary query/write with `org_id` taken only from the body.
- `verify_jwt = false` on a user-callable expensive or mutating function without an equivalent in-function authn/authz story (signature, shared secret, or user JWT + membership).
- Client-supplied `bucket`, `path`, `table`, or `recordId` passed to service-role storage/DB APIs without an allowlist and membership check (`process-image` historically takes `bucket`/`path`/`table` from the body).
- Inserting tasks, compliance, or memberships as service role after a nullable `getUser()` without membership verification (`assistant-action-executor` historically inserts with body `org_id`).
- Graph or listing endpoints that filter `eq("org_id", body.org_id)` on a service-role client with no membership check (`graph-query` / related graph functions — re-verify).
- Logging full request bodies that contain document text, emails, or tokens (`ai-extract` has logged payloads).

If you find these, do not ship a new feature that extends them. Propose the user-client + membership pattern instead.

## `verify_jwt` map

Source of truth: `supabase/config.toml`. Functions omitted from the file follow the platform default (historically JWT required — confirm before relying on it).

As of inspection, JWT verification was **disabled** for some user-callable or webhook functions, including:

- Webhooks / pipelines: `stripe-webhook`, `inbound-email`, `intake-process`
- AI: `ai-extract`, `ai-doc-analyse`, `ai-image-analyse`, `knowledge-critic`, `knowledge-discovery`

Disabled JWT is appropriate only when the function authenticates some other way (Stripe signature, Resend/Svix) or is invoked only with the service role from another trusted function. User-callable AI with JWT off is an abuse and tenant-isolation risk: re-verify and do not add more of this.

## CORS

`supabase/functions/_shared/cors.ts` uses `Access-Control-Allow-Origin: *`. Many functions duplicate that. Browser origin is not an access-control mechanism. Authorisation must stand without CORS.

When adding headers, keep Allow-Headers compatible with `@supabase/supabase-js` (see comments in `_shared/cors.ts`).

## Webhooks

| Function | Authn | Extra |
|---|---|---|
| `stripe-webhook` | `stripe-signature` + `STRIPE_WEBHOOK_SECRET` | Idempotent via `billing_events` id. Fail 503 if secrets missing. |
| `inbound-email` | Resend/Svix (`verifyResendWebhook`) | Resolve org from intake token, not from spoofable From alone. MIME allowlist. Path `orgs/{orgId}/inbox/…`. |

Do not use JWT as the webhook authenticator. Do not use a shared service-role bearer from the public internet.

## Secrets

Read from `Deno.env`. Never put `SUPABASE_SERVICE_ROLE_KEY`, Stripe, or provider keys in `VITE_*`.

If a function must call another function, prefer a server-side service-role invoke, not a browser-held secret.

## Abuse, cost, replay

User-callable functions that trigger AI, OCR, image pipelines, email, or large graph reads need:

- Authentication and org membership
- Org AI allowance (`assert_ai_ops_allowed` / `_shared/aiEntitlements.ts`) where AI is involved
- Request size limits
- Timeouts
- Idempotency keys for anything that creates rows or sends mail

Allowance gates that fail **open** on RPC error (current `assertAiOpsAllowed` behaviour) are a billing/abuse residual risk. Do not fail open for **authorisation**. See [resilience.md](resilience.md).

## Output exposure

Return only what the caller is allowed to see. Do not include other orgs' entities, raw provider errors with secrets, or full OCR text to callers who should only get suggestions.

AI actions that create assets or compliance records must re-check membership and must not persist hallucinated IDs from the model without a deterministic lookup in the caller's org.

## Checklist for a new or changed function

- [ ] Method allowlist
- [ ] Authn (JWT or provider signature)
- [ ] Authz (membership/role/resource) independent of body claims
- [ ] Schema validation; size limits
- [ ] Service role only after authz, least privilege
- [ ] `verify_jwt` in `config.toml` matches the threat
- [ ] Timeouts, bounded retries, idempotency
- [ ] No secrets in logs or responses
- [ ] Failure cannot look like success
- [ ] Negative tests: no JWT, wrong org, replay, oversized body
