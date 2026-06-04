# Supabase Migrations

Active migrations in this folder apply in filename order starting at **`20251218201715_filla_v2_init.sql`**.

Older **`202501…` / `202502…`** patches live in **`archive/legacy_pre_v2_init/`** (not run by `supabase db push`). They predate init and caused `attachments does not exist` / ordering failures on empty databases.

**Fresh remote setup:** Dashboard → reset database (if tables already exist) → `npm run db:push`.

**Drift recovery** (remote has `202501…`/`202502…` history or tables exist but v2 init is not recorded):

1. `npm run db:repair-stale-remote` — reverts archived legacy + Dec 2025 remote-only IDs
2. `npm run db:mark-local-applied` — records all local migration files as applied (schema already live)
3. `npm run db:push` — applies any new migrations only

---

## History context

### Feb 2025 — RLS iteration period

The files between `20250201000000` and `20250202000004` represent a rapid iteration cycle on Row Level Security (RLS) policies for the `attachments` table. Seven patch-over-patch migrations exist because the Supabase RLS policy for INSERT evaluated `auth.uid()` differently depending on whether the call came from a service-role client, an anon client, or a JWT-scoped client. Each file incrementally narrowed the issue; `20250202000003_final_attachments_rls_fix.sql` is the authoritative resolution.

**Why it happened:** Auth context in Supabase RLS policies is evaluated at statement time, not at function-call time. Using a helper function to resolve `org_id` worked for SELECT but failed for INSERT because the helper ran under `SECURITY DEFINER` and lost the caller's JWT. The fix was to reference `auth.uid()` directly in the policy condition without a wrapper.

This pattern has not recurred since. The convention established after this period is documented below.

### Jan–Mar 2026 — Stable conventions established

From `20260127` onwards, migrations follow the one-change-per-file convention. No `_final`, `_attempt`, or `_debug` suffixes are permitted.

---

## Conventions

### Naming

```
YYYYMMDDHHMMSS_short_snake_case_description.sql
```

- **One logical change per file.** Do not bundle unrelated schema changes.
- **No `_final`, `_attempt`, `_v2`, `_debug`, `_fix2` suffixes.** Each file must be correct as written or superseded by a new file.
- **Timestamps must be unique.** Use `HHMMSS` sub-seconds (e.g. `000001`, `000002`) within the same day.

### Content

- Always include `-- Description:` at the top of each file explaining what the migration does and why.
- Wrap DDL in a transaction where possible (`BEGIN; ... COMMIT;`).
- For RLS policy changes: add the new policy before dropping the old one to avoid a window where access is denied.
- For new tables: define RLS at creation time, not in a later migration.

### RLS

- Use `auth.uid()` directly in policy conditions — never via a `SECURITY DEFINER` helper function for INSERT policies.
- Always include both `USING` and `WITH CHECK` for UPDATE policies.
- Test with an anon client and a JWT client before committing.

---

## Seeding a platform admin

To grant platform admin access to a user, run the following SQL in the Supabase SQL editor (production) or via `psql`:

```sql
INSERT INTO platform_admins (user_id)
VALUES ('your-auth-user-uuid-here')
ON CONFLICT (user_id) DO NOTHING;
```

The `user_id` must match a row in `auth.users`. The admin panel is available at `/admin` in the application.

To revoke admin access:

```sql
DELETE FROM platform_admins WHERE user_id = 'your-auth-user-uuid-here';
```

---

## Key schema milestones

| Date | Migration | What changed |
|------|-----------|-------------|
| 2025-12-18 | `20251218201715_filla_v2_init.sql` | Full v2 schema init — all core tables |
| 2026-01-27 | `20260127*` series | Properties, spaces, assets, compliance RLS hardening |
| 2026-02-01 | `20260201*` series | Attachments table + RLS iteration (see above) |
| 2026-05-11 | `20260511000001_create_platform_admins.sql` | Platform admin role |
| 2026-05-11 | `20260511000002_create_admin_rpcs.sql` | Admin RPC functions (`admin_list_orgs`, etc.) |
| 2026-05-13 | `20260513000000_task_status_waiting_review.sql` | `waiting_review` status added to `task_status` enum |
| 2026-05-15 | `20260515000001_admin_activity_ai_requests_cursor.sql` | Cursor pagination for admin AI requests |
