# CHAPTER 3 — DATA MODEL & SUPABASE ARCHITECTURE

**3.1 — Core Principles**
Everything is org-scoped. Identity ≠ Permissions. Media is first-class. RLS is strict.

**3.2 — Complete Schema (Canonical)**

**Organisations:**
*   `organisations` (id, org_type)
*   `organisation_members` (role, assigned_properties)
*   `contractor_tokens` (task_id, token)

**Platform administration (Phase 2 — read-only `/admin`):**
*   `platform_admins` — `user_id` (PK → `auth.users`), `added_by`, `added_at`, `notes`. Separate privilege from org membership; grants cross-org **read** only via SECURITY DEFINER RPCs. RLS: authenticated users may SELECT their own row (`user_id = auth.uid()`); no app-level INSERT/DELETE. Rows are added in the Supabase dashboard or a controlled migration.
*   `is_platform_admin()` — stable SQL helper (SECURITY DEFINER) used by RPCs and the frontend guard.
*   Sentinel org UUID `00000000-0000-0000-0000-000000000000` — reserved `_platform` row in `organisations` so platform-scoped `audit_logs` rows can satisfy `org_id` FK; real org list queries exclude this id.
*   Admin RPCs (each checks admin, logs to `audit_logs`, returns empty if not admin): `admin_list_orgs`, `admin_get_org`, `admin_list_org_members`, `admin_get_org_activity`, `admin_get_org_ai_requests`.

**Properties & Assets:**
*   `properties` (address, type)
*   `spaces` (property_id, type)
*   `assets` (property_id, space_id, serial, condition_score)

**Tasks & Schedule:**
*   `tasks` — `status` enum: `open` | `in_progress` | `waiting_review` (vendor work submitted; manager sign-off pending) | `completed` | `archived`; plus `priority`, `due_date`, assignments, property/spaces/assets links.
*   `schedule_items` (frequency, next_occurrence)
*   `task_instances` (generated from schedule)
*   `issues` (captured anomalies)
*   `audit_logs` — append-only: `id`, `org_id`, `actor_id`, `entity_type`, `entity_id`, `action`, `metadata`, `created_at`. Task detail “Logs” reads rows where `entity_type = 'task'` and `entity_id = tasks.id` (org-scoped RLS).

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
*   `ai_requests` — append-only infrastructure log: every AI provider call made by an edge function. Columns: `id`, `org_id`, `user_id`, `function_name`, `model_used`, `provider`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `status` (success/error/timeout/fallback), `error_message`, `entity_type`, `entity_id`, `metadata`, `created_at`. Service-role INSERT only; org members can SELECT.
*   `ai_resolution_audit` — UX-level log: what AI suggested vs what the user chose. RLS now correctly references `organisation_members` (fixed in Phase 1).

**3.3 — RLS POLICY MAP**
*   **Universal:** `org_id = active_org_id`.
*   **Staff:** `AND property_id IN assigned_properties`.
*   **Contractor Free:** `task.contractor_token = jwt.token`.