# Data Model

Canonical reference for database tables, relationships, and naming conventions.

## Naming Conventions

- **Assignee field**: Use `assigned_user_id` (not `assignee_user_id`). Single canonical name across tasks, views, and app.
- **Org-scoped tables**: All org-scoped tables have `org_id` referencing `organisations.id`.
- **Timestamps**: `created_at`, `updated_at` as `timestamptz`.

## Key Tables

### organisations
- `id`, `name`, `slug`, `billing_email`, `created_by`, `created_at`

### organisation_members
- `org_id`, `user_id`, `role` — junction for user-org membership. Use for RLS and `useActiveOrg()`.

### tasks
- `id`, `org_id`, `title`, `description`, `status`, `priority`, `due_date`, `milestones` (JSONB, default `[]`), `property_id`, `assigned_user_id`, `created_at`, `updated_at`
- `milestones`: Array of `{id, dateTime, label?}` objects. Each milestone date appears on the calendar alongside `due_date`.

### tasks_view
- Optimized view with pre-joined property, spaces, themes, teams, images, milestones. Exposes `assigned_user_id` (no alias).

### properties
- `id`, `org_id`, `nickname`, `address`, `thumbnail_url`, etc.

### assets
- `id`, `org_id`, `property_id`, `space_id`, `name`, `asset_type`, `icon_name`, etc.

### themes
- `id`, `org_id`, `name`, `type` (category | hazard | etc), `color`, `icon`

### checklist_templates
- `id`, `org_id`, `name`, `category` (string: `compliance | maintenance | security | operations`), `items` (JSONB array), `is_archived` (boolean, default `false`), `created_at`, `updated_at`
- `items` stores an array of `{ title: string, is_yes_no: boolean, requires_signature: boolean }` objects.
- Categories are hardcoded in the UI (`CATEGORY_OPTIONS` in `SubtasksSection.tsx` and `TemplateDialog.tsx`).
- Fetched via `useChecklistTemplates(enabled)`. Mutations via `src/services/templates/templateService.ts`.
- Template library page: `src/pages/manage/ManageTemplates.tsx`.

### compliance_documents, compliance_portfolio_view
- Document metadata, expiry, space/asset links.

## RLS Patterns

- Org-scoped: `org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())`
- Do not rely on JWT `app_metadata.org_id` for data access; use `organisation_members` as source of truth.

## Regenerating Types

```bash
npx supabase gen types typescript --linked --schema public > src/types/supabase.ts
```
