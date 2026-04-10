# CHAPTER 3 — DATA MODEL & SUPABASE ARCHITECTURE

**3.1 — Core Principles**
Everything is org-scoped. Identity ≠ Permissions. Media is first-class. RLS is strict.

**3.2 — Complete Schema (Canonical)**

**Organisations:**
*   `organisations` (id, org_type)
*   `organisation_members` (role, assigned_properties)
*   `contractor_tokens` (task_id, token)

**Properties & Assets:**
*   `properties` (address, type)
*   `spaces` (property_id, type)
*   `assets` (property_id, space_id, serial, condition_score)

**Tasks & Schedule:**
*   `tasks` (status, priority, due_date)
*   `schedule_items` (frequency, next_occurrence)
*   `task_instances` (generated from schedule)
*   `issues` (captured anomalies)

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