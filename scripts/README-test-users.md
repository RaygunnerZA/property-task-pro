# Test users & role-play dev tooling

## Quick start

```bash
# 1. Create auth accounts (TEST-01 … TEST-06)
node scripts/create-test-users.js

# 2. Deploy edge function (once per Supabase project)
supabase functions deploy dev-ensure-org-personas

# 3. In the app (signed in as manager/owner of your dev org):
#    DevTools → Link test users to this org   (one-time per org)
#    DevTools → Switch test user → TEST-01 … TEST-06
```

Switching test users **automatically** links them to your **current active org** before sign-in, so you should not land on “create organisation” onboarding.

Optional CLI (same as the DevTools link action):

```bash
node scripts/seed-test-org-personas.js <your-org-id>
```

## Test personas

| ID | Name | Email | Org role | UI override |
|----|------|-------|----------|-------------|
| TEST-01 | Alice Staff | justinplunkett+alice@gmail.com | staff | — |
| TEST-02 | Bob Worker | justinplunkett+bob@gmail.com | staff | — |
| TEST-03 | Carol Manager | justinplunkett+carol@gmail.com | manager | manager |
| TEST-04 | David Member | justinplunkett+david@gmail.com | member | — |
| TEST-05 | Emma Technician | justinplunkett+emma@gmail.com | staff | contractor |
| TEST-06 | Frank Vendor | justinplunkett+frank@gmail.com | member | vendor |

Default password: `TestPassword123!` (override with `VITE_DEV_TEST_PASSWORD` in `.env.local`).

## DevTools behaviour

- **Switch test user** — real `signInWithPassword` session (RLS, assignees, messaging match the user).
- **UI role override** — client-only experience toggle (no auth change).
- **Seed role-play scenario** — creates three `[DEV] Role-play:` tasks plus a multi-author task thread (manager ↔ staff ↔ vendor).

## Environment

`.env.local`:

- `VITE_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (scripts only)
- `VITE_DEV_TEST_PASSWORD` (optional; defaults to `TestPassword123!`)

## Manual SQL (alternative to seed script)

```sql
INSERT INTO organisation_members (user_id, org_id, role, assigned_properties)
SELECT u.id, 'your-org-id'::uuid, 'staff', ARRAY[]::uuid[]
FROM auth.users u
WHERE u.email = 'justinplunkett+alice@gmail.com';
```
