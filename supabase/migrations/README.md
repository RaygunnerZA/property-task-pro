# Supabase migrations

Git is the rebuildable source of the Filla backend.

## Apply locally

Requires Docker (Docker Desktop or Colima).

```sh
supabase start
supabase db reset   # baseline + canonical gaps + storage + seed.sql
npm run gen:types
```

Do **not** Dashboard-reset project `gbtexoyvfpnduykmxunc` (it is production). Do **not** use `db:mark-local-applied` as a normal workflow.

## Active files (filename order)

| File | What |
|---|---|
| `20260817120000_baseline.sql` | Live public schema (2026-08-17 dump) |
| `20260817120001_reconcile_canonical_gaps.sql` | Docs/app objects missing on live |
| `20260817120002_storage_buckets_and_policies.sql` | Buckets + storage RLS |

History: `archive/pre_baseline_20260817/` (216 files, not run).

## New changes

One logical change per new `YYYYMMDDHHMMSS_description.sql`. No `_final` / `_ensure_*` as a substitute for a replayable baseline. Test with `supabase db reset` twice.

## Conventions

- `-- Description:` at the top.
- RLS at table creation. Default deny.
- Use `auth.uid()` plus membership helpers (`is_org_member`, `check_user_org_membership`). Do not rely on JWT `org_id` alone for new policies.
- Never disable RLS to make a feature work.

## Platform admin (local)

After reset, insert your **local** auth user:

```sql
INSERT INTO platform_admins (user_id)
VALUES ('your-local-auth-user-uuid')
ON CONFLICT (user_id) DO NOTHING;
```

Production: only with explicit authorisation; never seed a personal UUID in `seed.sql`.

## Hosted cutover

Staging: [STAGING.md](../STAGING.md). Production stamp: `npm run db:cutover-stamp` (refuses unless `FILLA_CUTOVER_CONFIRM` matches the project ref).
