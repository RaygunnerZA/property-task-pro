# Filla trust boundaries and architecture

Re-verify every named path, env var and client against the current repository. This file is a map of where to look, not a substitute for reading the code.

Constitutional chapters when topics overlap: `@Docs/01_Overview.md`, `02_Identity.md`, `03_Data_Model.md`, `04_UI_System.md`, `05_Task_Engine.md`, `19_Platform_Arch.md`, `20_Billing.md`, `Appendix_A.md`. Also: AI `07`, attachments `14`, ingestion `15`, lifecycle `21`, observability `24`, admin `25`, public origins `31`.

## Stack (inspect, do not assume)

Product app:

- Vite + React SPA (`package.json` scripts: `vite`, `vite build`).
- Client data access: `@supabase/supabase-js` in `src/integrations/supabase/client.ts`.
- Auth session: `localStorage` on the product origin. Comment in the client: never set cookie `Domain=.filla.app`.
- Org-scoped UI data: `useActiveOrg` / `ActiveOrgProvider`, membership-backed — not JWT `org_id` alone (`@Docs/02_Identity.md`, `src/hooks/useActiveOrg.ts`).
- Routing: React Router in `src/App.tsx`. `src/app/page.tsx` is the workbench page, not a Next.js App Router entry.
- Deployed as the product Vercel project on `app.filla.app` (`@Docs/31_Public_Site.md`).

Marketing:

- Separate app in `marketing/`.
- Must not load Supabase or `VITE_SUPABASE_*`.
- Origin: `www.filla.app`.

Inbound email:

- MX on `inbox.filla.app` (`@Docs/15_External_Ingestion.md`).
- Webhook: `inbound-email` Edge Function.

Backend:

- Supabase Auth, PostgreSQL + RLS, Storage, Edge Functions (`supabase/functions/`).
- Shared Edge utilities: `supabase/functions/_shared/`.
- Migrations: `supabase/migrations/`. `@Docs/03_Data_Model.md` is the constitutional schema source; if code and docs disagree, flag the discrepancy.

## Trust boundaries

| Boundary | Trusted identity | Untrusted input | Privileged systems |
|---|---|---|---|
| Browser → Supabase Data API | JWT from `supabase.auth.getUser()`; RLS | Query filters, `org_id`, row payloads | Postgres via PostgREST |
| Browser → Edge Function | JWT in `Authorization` **if** verified in code **and** membership checked | JSON body, file URLs, IDs | Service-role client, AI providers, Stripe, Google, Resend |
| Provider webhook → Edge Function | Provider signature (Stripe, Resend/Svix) | Webhook payload | Service-role client |
| Storage upload | Auth + storage policies | File bytes, filename, MIME, path | Storage buckets |
| AI provider → Filla | None. Model output is untrusted | Prompt, file content, structured JSON | DB writes after validation |
| Platform admin UI → RPCs | `is_platform_admin()` inside SECURITY DEFINER RPCs | Admin filters | Cross-org read (and narrow platform-config writes) |
| Contractor token | Token validated server-side / RPC | Token in URL or localStorage | Shared task only |
| Marketing origin | None for product data | Any script on www | Must not reach app session |

`ProtectedRoute` and `/admin` layout guards are UX. They are not authorisation.

## Identity and authorisation

Canonical roles (`@Docs/02_Identity.md`): Owner (Primary Owner), Manager, Staff. Legacy `member` must be treated as Staff. External access is restricted sharing, not durable membership. Contractor Free uses token/link access to a shared task.

Derive:

1. User id from `auth.getUser()` / `auth.uid()`.
2. Organisation membership from `organisation_members` (role, `assigned_properties`, `is_primary_owner`, `membership_status`).
3. Permission for the **specific** action on the **specific** org/property/resource.

Do not trust:

- Request JSON `org_id`, `user_id`, `role`
- JWT `app_metadata.org_id` / `active_org_id` as the only org source
- Frontend `useActiveOrg()` as a server-side control
- Presence of a UUID as proof of access

Platform admin is a separate privilege (`platform_admins`, `is_platform_admin()`). It is not an org role. Cross-org access must go through named SECURITY DEFINER RPCs, not `OR is_platform_admin()` on every RLS policy (`@Docs/25_Phase2_Admin_Panel_Spec.md`). Frontend admin routes are not the control.

## Origins and sessions

Auth redirects and Site URL must stay on the product origin (`@Docs/31_Public_Site.md`). Marketing XSS must not be able to read product `localStorage`.

In development the client may attach `window.supabase` (`src/integrations/supabase/client.ts`). That must not ship as a production behaviour.

## Frontend vs server secrets

Public (frontend `VITE_*` — assume attacker-visible):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_POSTHOG_KEY`
- `VITE_GOOGLE_MAPS_API_KEY` (restrict by HTTP referrer)
- `VITE_APP_URL`, `VITE_MARKETING_URL`

Server-only (Edge secrets / `.env` never bundled):

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `GEMINI_API_KEY`, `OPENAI_API_KEY`, `LOVABLE_API_KEY`
- `RESEND_WEBHOOK_SECRET`, Resend API keys
- `GOOGLE_MAPS_SERVER_KEY`
- Database password

`VITE_APP_DEV_BUILD` and `VITE_DEV_TEST_PASSWORD` widen attack surface if set on a reachable deployment. Treat enabling them in production as a security decision.

## External services (verify in repo)

Typical integrations: Stripe (checkout, portal, webhooks), Google Maps / geocoding / address validation, Resend inbound email, PostHog analytics, AI providers (Gemini, OpenAI, Lovable), optional Google/Microsoft OAuth for calendar/drive (`oauth-connect-start`).

For each new integration ask: what identity is trusted, what happens on timeout, and whether failure is security-relevant (fail closed) or enrichment (fail soft).

## Document vs implementation

Known classes of discrepancy to re-check rather than paper over:

- `@Docs/03_Data_Model.md` §3.3 describes RLS as `org_id = active_org_id`. Live policies more often use membership helpers such as `check_user_org_membership` and `member_can_access_property` because JWT `active_org_id` may be unset.
- `@Docs/14_Attachments.md` describes `/org/{id}/tasks/` style paths. Live storage uses named buckets (`task-images`, `inbox`, `property-plans`, …). Path conventions differ per bucket (`org/…` vs `orgs/…`).
- `@Docs/24_Phase1_Observability_Spec.md` still describes missing `_shared/` and missing PostHog in places; both exist in the current tree.
- `@Docs/09_Dev_Infra.md` is brief relative to the actual Vite + Edge Function layout.

When docs and code disagree, flag it. Do not silently pick one.

## Where to look

- Client: `src/integrations/supabase/client.ts`, `src/hooks/useActiveOrg.ts`, `src/contexts/DataContext.tsx`
- Route guards: `src/components/ProtectedRoute.tsx`, `src/pages/admin/AdminLayout.tsx`
- Contractor: `src/pages/contractor/`, `contractor_tokens`, RPCs such as `get_task_with_contractor_token`
- Env inventory: `.env.example`
- Function inventory: `supabase/functions/`, `supabase/config.toml`
