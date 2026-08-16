# CHAPTER 3 — DATA MODEL & SUPABASE ARCHITECTURE

**3.1 — Core Principles**
Operational data is org-scoped. Identity ≠ Permissions. Media is first-class. RLS is strict.
**Exception — Platform Knowledge:** verified Filla-curated Knowledge rows may have `org_id IS NULL` and are readable cross-org when `status = published` via explicit table policies (not `OR is_platform_admin()` on every org table). See Knowledge below.

**3.2 — Complete Schema (Canonical)**

**Organisations:**
*   `organisations` (id, org_type: `personal` | `business` | `contractor`)
*   `organisation_members` (role, assigned_properties, `is_primary_owner`, `membership_status`) — canonical roles: `owner` | `manager` | `staff`. Legacy `member`/`admin` normalize to Staff/Manager (`02_Identity`). Exactly one Primary Owner per org. External access is link/token scoped (`revoke_invitation` / contractor tokens), not a durable membership role by default.
*   `contractor_tokens` (task_id, token)
*   Billing/plan state and entitlements: see `@Docs/20_Billing.md` (do not invent plan columns without that chapter + schema migration).

**Platform administration (Phase 2 — read-only `/admin`):**
*   `platform_admins` — `user_id` (PK → `auth.users`), `added_by`, `added_at`, `notes`. Separate privilege from org membership; grants cross-org **read** only via SECURITY DEFINER RPCs. RLS: authenticated users may SELECT their own row (`user_id = auth.uid()`); no app-level INSERT/DELETE. Rows are added in the Supabase dashboard or a controlled migration.
*   `is_platform_admin()` — stable SQL helper (SECURITY DEFINER) used by RPCs and the frontend guard.
*   Sentinel org UUID `00000000-0000-0000-0000-000000000000` — reserved `_platform` row in `organisations` so platform-scoped `audit_logs` rows can satisfy `org_id` FK; real org list queries exclude this id.
*   Admin RPCs (each checks admin, logs to `audit_logs`, returns empty if not admin): `admin_list_orgs`, `admin_get_org`, `admin_list_org_members`, `admin_get_org_activity`, `admin_get_org_ai_requests`, `admin_list_knowledge_review_queue`, `admin_get_knowledge`, `admin_set_knowledge_status`, `admin_upsert_platform_knowledge`, `admin_knowledge_metrics_snapshot`.

**Properties & Assets:**
*   `properties` (address, type, nickname, icon fields, thumbnail, `is_archived` — inactive properties do not count toward billing; **location:** `latitude`, `longitude`, `place_id`, `address_formatted`, `address_components`, `geocoded_at`, `address_validated_at`, `geo_accuracy_m`)
*   Billing: `subscription_tiers`, `org_subscriptions` (+ `billing_state`, `grace_ends_at`, seat add-ons via `seat_count`, evidence packs via `storage_addon_bytes`), `org_usage` (+ `metrics` JSONB incl. evidence breakdown), `billing_events` (webhook idempotency) — see `@Docs/20_Billing.md`
*   `spaces` (property_id, type, icon_name, thumbnail_url — mini-card / photo path for space identity; floor_level)
*   `assets` (property_id, space_id, serial, condition_score)

**Building setup (plan sheets → proposed Spaces):**
*   `property_plan_files` — uploaded PDF/image sheets; setup context: `building_label`, `floor_label`, `scale_known`, `units`, `setup_notes`; status lifecycle through review/import.
*   `property_plan_pages` — converted page images for preview/extraction.
*   `plan_extraction_runs` — one run per process; stores raw/normalised model output.
*   `extracted_spaces` — reviewable proposals (`is_accepted` default false; `floor_label`, `review_band`); import via `import_plan_extraction_run` creates Spaces only by default (assets/tasks deferred).
*   Related review tables (`extracted_assets`, `extracted_compliance_elements`, `extracted_task_suggestions`) remain for later assistant steps; V1 process does not populate them.

**Signals (infrastructure — Issues triage):**
*   `signals` — org-scoped platform signals: `kind`, `category` (`environmental` | `location` | `property` | `compliance` | `operational`), `subtype`, `severity`, `title`, `body`, `review_state`, `disposition`, `source`, `payload`, `recommendation`, `dedupe_key`, lifecycle fields (`expires_at`, `resolved_at`, `converted_entity_type/id`). RLS: org members SELECT; managers UPDATE. Emitted via `emit_signal()` (service role, idempotent on `dedupe_key`).
*   `signal_recommendation_templates` — maps `subtype` → recommended action (`create_task`, `create_record`, `alert`).
*   `geo_captures` — one-shot GPS at work actions: `latitude`, `longitude`, `accuracy_m`, `capture_context`, links to `task_id`, `attachment_id`, `property_id`, etc. RLS: org SELECT; user INSERT own capture only.

**Signal RPCs:** `emit_signal`, `resolve_signal`, `snooze_signal`, `convert_signal_to_task`, `update_property_geo`.

**Tasks & Schedule:**
*   `tasks` — `status` enum: `open` | `in_progress` | `waiting_review` (vendor work submitted; manager sign-off pending) | `completed` | `archived`; plus `priority`, `due_date`, assignments, property/spaces/assets links. UPDATE: `member_can_mutate_task` — Owner/Manager or `assigned_user_id = auth.uid()`. Followers do not gain UPDATE.
*   `task_followers` — `(task_id, user_id)` PK; `org_id`, `created_at`, `created_by`. Watchers of a task. Must be active org members; must not be the assignee. INSERT/DELETE: same mutate helper as task UPDATE. SELECT inherits `tasks` RLS (invoker subquery). Exposed on `tasks_view.follower_user_ids`.
*   `schedule_items` (frequency, next_occurrence)
*   `task_instances` (generated from schedule)
*   `issues` (captured anomalies)
*   `audit_logs` — append-only: `id`, `org_id`, `actor_id`, `entity_type`, `entity_id`, `action`, `metadata`, `created_at`. Task detail “Logs” reads rows where `entity_type = 'task'` and `entity_id = tasks.id` (org-scoped RLS). The property hub **activity** strip merges `tasks` rows for a `property_id` with those same task-scoped `audit_logs` (no new columns). **Insights → Compliance drift** uses `compliance_portfolio_view` for that property (`expiry_state` expired/expiring). **Insights → Field assignees** uses `tasks_view` (`assigned_user_id`) plus `organisation_members.role` for labels.

**Compliance:**
*   `compliance_sources` (raw files)
*   `compliance_documents` (expiry_date, status)
*   `compliance_rules` (logic)
*   `compliance_recommendations` (AI-style suggested actions per document)

**Onboarding demo (new properties):**
*   `seed_onboarding_demo_for_property(property_id)` runs in the same trigger as `seed_property_defaults` after each `properties` INSERT. Seeds sample tasks, assets, compliance documents, one compliance rule, one `compliance_recommendations` row, and an org-level checklist template (once per org). Demo copy includes `[onboarding_demo]` for UI detection; placeholder images use `/onboarding/*.svg`.

**Media:**
*   `attachments` (file_url, parent_type, parent_id)
*   `evidence` (task_id, attachment_id)

**AI Observability (Phase 1):**
*   `ai_requests` — append-only infrastructure log: every AI provider call made by an edge function. Columns: `id`, `org_id`, `user_id`, `function_name`, `model_used`, `provider`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_usd`, `cost_units`, `latency_ms`, `status` (success/error/timeout/fallback), `error_message`, `entity_type`, `entity_id`, `metadata`, `created_at`. Service-role INSERT only; org members can SELECT.
*   `input_tokens`, `output_tokens` and `cost_usd` are **populated**. Provider token counts are read from `usageMetadata` (Gemini) and `usage` (OpenAI-compatible) and priced by `estimateCost`. `cost_usd` is NULL only when a provider returned no usage or the model is not in the price table — never because the call site passed nulls.
*   `prompt_version` is populated for **all** AI functions via the call boundary, not `knowledge-critic` alone. A model score is only meaningful for a specific `(model, prompt_version)` pair.
*   `metadata` carries `capability`, `strategy_id` and `attempt` for every boundary call, plus `escalation: true` on escalated runs. This is what makes retries and fallbacks separable after the fact.
*   `ai_resolution_audit` — UX-level log: what AI suggested vs what the user chose. RLS now correctly references `organisation_members` (fixed in Phase 1). It carries **no link to `ai_requests`**, so its correction rate is not attributable to a model (see `admin_ai_resolution_metrics`).

**AI routing and evaluation (AI call boundary):**
*   Capability definitions and approved strategies live in **code** (`supabase/functions/_shared/aiRouting.ts`), not in the database. Normal model changes therefore stay in git history where they are reviewable and revertible. There is no `ai_models` registry table; with two live models an eleven-column registry would be speculative schema.
*   `ai_route_overrides` — emergency pin only: `capability` (UNIQUE), `strategy`, `reason` (NOT NULL, non-blank), `set_by`, `expires_at`, timestamps. **Platform scope, not org data.** RLS grants SELECT to `is_platform_admin()` only; there is deliberately **no org policy**, in explicit contrast to `ai_requests`, which org members may SELECT for their own usage. A route override affects every org, so no org may read or change it.
    *   Writes go through `set_ai_route_override` / `clear_ai_route_override` (platform admin only, each emits an `audit_logs` row).
    *   `active_ai_route_overrides()` is the service-role read used by the boundary; it never returns an expired pin.
    *   **A missing, empty or unreadable row means use the compiled default.** A broken override table must never take down every AI feature.
    *   A pin cannot escape a capability's requirements (vision/PDF), credential availability, or the critic provider-distinctness rule. It reorders approved strategies; it does not authorise unapproved ones.
*   `ai_capability_evals` — golden-set eval runs: `capability`, `model`, `prompt_version`, `provider`, `fixture_set`, `fixture_count`, `recall`, `false_positive_rate`, `schema_valid_rate`, `latency_ms_p50`, `cost_usd`, `detail`, `notes`, `created_by`. Platform-admin SELECT; inserts via `record_ai_capability_eval` (service role only, used by `scripts/run-ai-eval.mjs`). Scores are comparable only **within** one `fixture_set`.
*   Production-derived metrics are functions, not tables, because the ground truth already exists in review outcomes:
    *   `admin_ai_plan_extraction_metrics(since)` — correction / rejection / acceptance rate per `(model, prompt_version)`, from `extracted_spaces` (`edited_name`, `is_accepted`, `imported_space_id`) joined to `ai_requests` via `metadata->>'extraction_run_id'`.
    *   `admin_ai_resolution_metrics(since)` — suggestion correction rate per day from `ai_resolution_audit`, **without** model attribution.
*   There is no `minimum_quality_score` in any route configuration. There is no runtime quality signal, so quality gates promotion decisions offline; a number in the route table would only invite a fake one.

**Knowledge (first-class entity — two axes):**
*   **Axes (independent):** `scope` (`platform` | `organisation`); `status` (`candidate` | `verified` | `published` | `stale` | `archived`).
*   **Source kinds (provenance, not scope):** `filla_curated` | `org_upload` | `operational_discovery` | `community_brain`.
*   `knowledge` — `id`, `scope`, `status`, `org_id` (NULL iff `scope = platform`; CHECK: platform ⇒ `org_id` NULL, organisation ⇒ `org_id` NOT NULL), `title`, `summary`, `body`, `content` (jsonb), `source_kind`, `trust_score` (critic-written numeric), `provenance` (jsonb: extractor/critic models, prompt versions, source refs), `cohort_size` (nullable; required ≥ `BRAIN_MIN_COHORT` = 5 before publish when `source_kind = community_brain`), `version`, `supersedes_id` (self-FK), `created_by`, `reviewed_by`, `published_at`, timestamps.
*   `knowledge_sources` — citations / attachments / URLs / brain pattern keys backing a knowledge row.
*   `knowledge_links` — org-scoped join: `org_id`, `knowledge_id`, `entity_type`, `entity_id`, `relationship`; unique `(org_id, knowledge_id, entity_type, entity_id)`. Knowledge is **not** a `property_graph_edges` node.
*   `knowledge_verification_events` — append-only: extractor, critic, human approve/reject/edit, stale flags.
*   **RLS:** Organisation rows — members SELECT; Owner/Manager INSERT/UPDATE candidates and verified; publish/archive Owner/Manager only; customers never UPDATE `scope = platform`. Platform `published` — SELECT for any authenticated org member. Platform non-published — no direct client SELECT; platform_admins via SECURITY DEFINER RPCs only. Service role writes candidates from edges.
*   **Org RPCs:** `list_published_knowledge`, `list_org_knowledge_review_queue`, `set_knowledge_status`, `upsert_org_knowledge`, `link_knowledge_entity`.
*   **Service helpers:** `create_knowledge_candidate`, `apply_knowledge_critic_result`, `list_brain_patterns_for_community` (cohort-gated Brain read for Community candidates).
*   **Publish rules:** never auto-publish; community publish gated by `cohort_size >= 5` in RPC; Discovery may emit organisation `candidate` rows only; Community candidates extend Filla Brain (`filla_brain.*` patterns), never a second anonymization pipeline.
*   Knowledge does **not** replace Compliance, Records, Tasks, Signals, or Messages.
*   **Knowledge metrics:** `knowledge_usage_events` — `reused` | `question_answered` | `automation_created` | `time_saved` with `estimated_minutes`. Defaults: answered 5m, reused 2m, automation 10m (`knowledge_metric_default_minutes`). Write via `record_knowledge_usage`. Snapshots: `admin_knowledge_metrics_snapshot`, `org_knowledge_metrics`. Counts: created = knowledge rows; verified = status in verified|published; reused/answered/automation/time saved from usage events.

**Filla Brain cohort floor:**
*   `brain_infer_asset` / `brain_infer_compliance` return zero-sample fallbacks when aggregated `sample_count < 5` (`BRAIN_MIN_COHORT`). Same floor applies to Community Knowledge promotion. Threshold is SQL/code, never LLM judgement.

**3.3 — RLS POLICY MAP**
*   **Universal (operational tables):** `org_id = active_org_id`.
*   **Staff:** `AND property_id IN assigned_properties`.
*   **Contractor Free:** `task.contractor_token = jwt.token`.
*   **Platform Knowledge published:** authenticated members of any org may SELECT `knowledge` where `scope = platform` AND `status = published`.