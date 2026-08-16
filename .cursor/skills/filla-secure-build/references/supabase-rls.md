# Filla Supabase / RLS patterns

Re-read current policies and helper functions before changing access. Historical migrations include superseded policies; the latest applied migration for a table wins.

Constitutional schema source: `@Docs/03_Data_Model.md`. Never invent columns.

## Doctrine for this repo

- RLS is the security boundary for anything the browser can reach through the Data API.
- Do not disable RLS.
- Do not "fix" a policy by switching the client to `SUPABASE_SERVICE_ROLE_KEY`.
- Service role bypasses RLS. It belongs only in Edge Functions / tightly scoped server jobs.
- Test SELECT, INSERT, UPDATE and DELETE separately, with two authenticated users from different organisations, and with the wrong role in the same organisation.

## Helpers actually used (re-verify definitions)

Look up the latest `CREATE OR REPLACE` in `supabase/migrations/` (ignore `archive/` unless diagnosing history).

| Helper | Typical use | Notes to re-check |
|---|---|---|
| `check_user_org_membership(org_id)` | Many INSERT/SELECT policies and storage path checks | SECURITY DEFINER, `search_path = public`, uses `auth.uid()`. Older grants included `anon` — confirm current grants. |
| `member_can_access_property(org_id, property_id)` | Property-scoped SELECT / writes | Membership row, `membership_status = active`. **Empty or null `assigned_properties` currently grants all properties in the org.** Docs §3.3 say Staff are limited to assigned properties. Flag this if changing Staff scope. |
| `member_can_create_tasks(org_id)` | Task INSERT | Owner/Manager only (Staff denied). |
| `is_platform_admin()` | Admin RPCs | Reads `platform_admins`. Not an org role. |
| `assigned_properties()` | Older policies | Reads JWT claim `assigned_properties`. Identity docs say JWT must not be the only source. Prefer membership-table helpers for new policies. |
| `current_org_id()` | Legacy | JWT `active_org_id`. New policies should not depend on this alone. |

`organisation_members_primary_owner_guard` blocks removing or demoting the last Primary Owner without transfer.

## Policy design

Default deny: no policy ⇒ no access.

Org-scoped operational tables: caller must be an **active** member of `org_id`. Then apply role and property assignment as required by `@Docs/02_Identity.md`.

Staff vs Owner/Manager:

- Property visibility: assignment list (but see empty-array behaviour above).
- Task creation: `member_can_create_tasks` — do not re-open Staff INSERT without an explicit product decision.

Platform Knowledge: published `scope = platform` may be readable by authenticated members of any org. Non-published platform rows: no direct client SELECT; platform admins via SECURITY DEFINER RPCs only (`@Docs/03_Data_Model.md`).

Platform-scoped config such as `ai_route_overrides` must not gain an org read/write policy. A route pin affects every organisation.

## SECURITY DEFINER

Review every new or touched definer function for:

1. `SET search_path` pinned (usually `public`; include extra schemas only when required).
2. Authorisation **inside** the function using `auth.uid()`, not arguments claiming to be the user.
3. Least privilege: `REVOKE ALL … FROM PUBLIC` then `GRANT EXECUTE` to `authenticated` (or no client grant for edge/cron-only).
4. No accidental grant to `anon` unless the function is safe unauthenticated (almost never).
5. Tenant filter on every query — definer bypasses RLS.
6. Audit log for privileged or cross-org reads/writes.

Internal / cron / edge-only definers have been revoked from `authenticated` in migrations such as `20260701160000_disable_pg_graphql_and_lock_internal_rpcs.sql`. Do not re-grant them to the browser role to make a feature easier.

`pg_graphql` was dropped because the app uses PostgREST. Do not re-enable it without a security review.

## Platform admin

- Table `platform_admins`: self-SELECT only. No app INSERT/DELETE policy.
- Cross-org data: named RPCs that call `is_platform_admin()`, raise on failure, and write `audit_logs`.
- Customer-data writes from admin UI remain out of scope unless the constitution/spec is updated (`@Docs/25_Phase2_Admin_Panel_Spec.md`).
- Platform-configuration writes (for example AI route overrides) need: admin check, audit row, mandatory reason, expiry or equivalent, and no escape from code-level constraints.

Frontend `/admin` is not sufficient.

## Client data loading

Application code uses `useActiveOrg` for org-scoped fetches (project rule). That is necessary for correct UX and cache keys. It is **not** a substitute for RLS. A malicious client can send any `org_id`.

## Storage RLS

Storage policies are separate from table RLS. Inspect `storage.objects` policies and `storage.buckets.public` for the bucket you touch.

Public bucket + `getPublicUrl()` means anyone with the URL can read the object, regardless of org membership. Authenticated policies on a public bucket do not restore confidentiality of leaked URLs.

Path checks must bind the first UUID segment to a membership the caller actually has. Filename obscurity is not access control.

## Integrity

Prefer foreign keys, unique constraints, check constraints, and transactions over frontend-only validation.

Invitation acceptance, org creation, membership changes and Primary Owner transfer must remain database-enforced.

Soft-delete / archive is the default lifecycle posture (`@Docs/21_Data_Lifecycle.md`). Hard delete of org or evidence needs extra scrutiny, export grace, and must not be run against production because it is convenient.

## Adversarial tests for RLS changes

- Unauthenticated: no rows.
- Org A member cannot SELECT/INSERT/UPDATE/DELETE Org B rows by guessed UUID.
- Staff cannot perform Owner/Manager-only writes.
- Suspended membership (`membership_status`) cannot act.
- Contractor token cannot read org-wide data.
- Platform admin without using the named RPC cannot SELECT customer tables.
- Storage: cannot upload or delete under another org's prefix.
