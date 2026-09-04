# Schema discrepancy register

Working document (not constitutional). Captured **2026-08-17** from hosted project `gbtexoyvfpnduykmxunc` (the only environment: dev = prod). Classify each gap: **keep live** / **keep docs** / **bug**. Squash did **not** silently “fix” RLS semantics.

Freeze: no Dashboard DDL; no `db:mark-local-applied` as normal workflow. New schema = a new file under `supabase/migrations/` after the baseline.

## Sources compared

| Source | Role |
|---|---|
| Live dump (`pg_dump --schema-only`) | Operational schema |
| `@Docs/03_Data_Model.md` + `@Docs/20_Billing.md` | Product contract |
| `src/integrations/supabase/types.ts` | Types the app compiles against |
| `src/types/supabase.ts` | Previously `gen:types --linked` (stale / unused) |

## Environment

`gbtexoyvfpnduykmxunc` is production **and** shared dev. Do **not** Dashboard-reset it. Local: `supabase start`. Staging: new project (see [supabase/STAGING.md](../supabase/STAGING.md)).

## Live vs constitution (keep docs → added in `20260817120001`) — Resolved

These objects were missing on live at squash capture and were **added** via `20260817120001_reconcile_canonical_gaps.sql` (and follow-ups). Do not re-litigate as open gaps.

| Object | Live (at capture) | Docs / app | Status |
|---|---|---|---|
| `platform_admins`, `is_platform_admin()`, admin RPCs | missing | required | **Resolved** — present on live |
| `task_followers`, `member_can_mutate_task` | missing | required | **Resolved** — present on live |
| `ai_route_overrides` + pin RPCs | missing | required | **Resolved** — present on live |
| `geo_captures` + `geo_capture_context` | missing | required | **Resolved** — present; RLS uses `is_org_member`, not JWT-only `current_org_id` |
| `issues`, `evidence`, `contractor_tokens`, `schedule_items`, `task_instances` | missing | listed in Ch 3 | **Resolved** — minimal tables + org RLS |
| `geo_captures` insert using `current_org_id()` | n/a | skill: JWT must not be only org source | **Resolved** — overlay uses membership helper |

## Live vs constitution (not created in squash)

| Object | Notes | Decision |
|---|---|---|
| `asset_inspections`, `asset_themes`, `assistant_logs`, `brain_extract_pending`, `compliance_auto_tasks`, `compliance_contractors`, `compliance_history`, `listed_buildings`, `notification_events`, `notifications`, `property_graph_edges`, `property_legal`, `property_utilities`, `space_ui_groups`, `task_assets`, `task_compliance`, `task_image_annotation_versions`, `task_teams` | In app generated types and/or old migrations; **not** on live | **bug / later PR** — do not invent in squash. Add forward migrations when the product path needs them. |
| `ai_capability_evals` + `record_ai_capability_eval` + `admin_ai_plan_extraction_metrics` / `admin_ai_resolution_metrics` | Archive-only at squash; client already wrote `ai_resolution_audit` | **Resolved** — `20260902120000` applied on live. `admin_list_ai_route_overrides` (`20260903080000`) is the admin read path (Ch 25 RPCs). `ai_resolution_audit` still has no `ai_request_id` (Stage 6). |
| Empty `assigned_properties` grants all properties | Skill + docs §3.3 disagree | **bug (flagged)** — do not change in squash |

## Live-only / legacy (keep live)

Tables on live that are not in Ch 3 as first-class: `groups`, `group_members`, `task_groups`, `activity_log`, `ai_models`, `ai_prompts`, `ai_extractions`, `labels`, `task_labels`, `subtasks`, `task_images`, `task_threads`, `thread_messages`, etc.

**keep live** in the baseline so local matches production. Do not drop without a dedicated data migration.

Ch 3 says there is **no** `ai_models` registry; live still has the table. Keep the table; routing stays in code.

## Dual TypeScript types — Resolved

| File | Role |
|---|---|
| `src/integrations/supabase/types.ts` | **App source of truth** (`client.ts`) |
| `src/types/supabase.ts` | Re-export / legacy alias — not a second schema |

`npm run gen:types` dumps **local** public schema into `src/integrations/supabase/types.ts`.

## Storage

Live buckets: `inbox` (private), `property-images` (public), `property-plan-pages`, `property-plans`, `task-images` (public), `user-avatars` (public).

**keep live.** Public buckets: anyone with the URL can read; RLS does not restore confidentiality of leaked URLs.

`property-images` object policies only check `auth.uid() IS NOT NULL` (no org path). **bug (flagged)** — not changed in squash.

Audio bucket from old migrations is **not** on live. **keep live** (omit) until a product path needs it.

## Auth (Dashboard — cannot dump)

Hosted: Site URL / redirects must stay on the product origin `https://filla.app` (`@Docs/31_Public_Site.md`). `app.filla.app` is not live.

Local: Inbucket + `site_url = http://127.0.0.1:8080` in `supabase/config.toml`. Social providers are **not** copied; enable per project.

## `verify_jwt = false` inventory

| Function | In-function auth | Verdict |
|---|---|---|
| `stripe-webhook` | `stripe-signature` + `STRIPE_WEBHOOK_SECRET` | Appropriate |
| `inbound-email` | `verifyResendWebhook` | Appropriate |
| `intake-process` | no `getUser()`; service-role downstream | **bug (flagged)** — user-callable JWT off |
| `ai-extract` | no user `getUser()` | **bug (flagged)** — abuse / tenant risk |
| `ai-doc-analyse` | no user `getUser()` | **bug (flagged)** |
| `ai-image-analyse` | no user `getUser()` | **bug (flagged)** |
| `knowledge-critic` | no user `getUser()` | **bug (flagged)** |
| `knowledge-discovery` | no user `getUser()` | **bug (flagged)** |

Squash does **not** flip these flags. Track as security follow-up; do not add more JWT-off user-callable functions.

## Pending local migrations (not yet on live)

| Object | Notes | Decision |
|---|---|---|
| `knowledge_claims` + claim RPCs (`20260903200000_knowledge_claims.sql`, `20260904090000_knowledge_claims_enrichment.sql`) | Atomic source-backed facts under Knowledge; Content SEO grounding uses verified claims; `knowledge-extract-claims` re-extracts from sources; output grounding critic stores `structured.grounding`. Docs updated in Ch 3 / Ch 29. | **Apply via `npm run db:push`** |

## Policies that depend on JWT org claim

Many live policies use `current_org_id()` (JWT `app_metadata.org_id`, else first membership). Identity docs: JWT must not be the only org source. **keep live** for squash; prefer `is_org_member` / `check_user_org_membership` on new objects.

## Typecheck / lint

`@Docs/28_TypeScript_Strictness_Debt.md` claims `tsc` is clean; it is not. Compiler debt is a **parallel track**, not part of this squash.
