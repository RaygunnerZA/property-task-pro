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

**Media:**
*   `attachments` (file_url, parent_type, parent_id)
*   `evidence` (task_id, attachment_id)

**3.3 — RLS POLICY MAP**
*   **Universal:** `org_id = active_org_id`.
*   **Staff:** `AND property_id IN assigned_properties`.
*   **Contractor Free:** `task.contractor_token = jwt.token`.