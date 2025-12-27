# CHAPTER 5 — TASK, SCHEDULE & AUTOMATIONS SYSTEM

**5.1 — TASK MODEL (V2 Enhanced)**
The central operational object.
*   **Core:** `id`, `org_id`, `title`, `description`, `status`, `priority`.
*   **Context:** `property_id` (Parent), `space_ids` (Many-to-Many), `asset_ids` (Many-to-Many).
*   **People:** `assigned_user_id` (Primary), `assigned_team_ids` (Support).
*   **Categorization:** `group_ids` (Work types like Plumbing/Compliance).

**5.2 — TASK DETAIL LAYOUT**
*   **Desktop:** Right-side slide-over panel (Dual-Pane).
*   **Mobile:** Full-screen page.
*   **Tabs:** Summary, Messaging, Files, Logs.

**5.3 — SUBTASKS (CHECKLIST)**
Tasks support a `checklist` JSONB array or sub-table for execution steps.

**5.4 — LOGS & AUDIT**
Every action (Status change, Assignment, Edit) writes to `audit_logs`.