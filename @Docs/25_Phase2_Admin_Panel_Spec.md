# CHAPTER 25 — PHASE 2: ADMIN PANEL SPEC

**Status:** Approved for implementation after Phase 1 is complete  
**Depends on:** Phase 1 (`ai_requests` table must exist; PostHog must be installed)  
**Risk level:** Medium — introduces a new privilege concept and cross-org data access  
**Touches:** `supabase/migrations/`, `src/pages/admin/`, `src/App.tsx`

---

## 25.0 — Scope and Non-Scope

### In scope (Phase 2)

- A `platform_admins` table and `is_platform_admin()` helper function
- SECURITY DEFINER RPCs that expose cross-org data exclusively to platform admins
- A read-only `/admin` route with three views: org list, org detail, AI requests viewer
- An admin access guard component
- Audit logging of every admin data access

### Not in scope (deferred to Phase 4)

- Data override (editing tasks, fixing compliance records)
- Impersonation of any kind
- Email/message sending
- Cross-org write operations of any kind
- Support ticketing integration

Phase 2 is intentionally read-only. The value of an admin panel comes from visibility. The risk comes from write access. Separate them by at least one phase.

---

## 25.1 — Security Model

### Core principle

Platform admin privilege is a separate concept from org membership. It must not be derived from any org role. A platform admin is not a member of every organisation — they are a separate class of user with cross-org read access.

The security model has three layers:

1. **Database layer**: A `platform_admins` table. All cross-org queries are gated by `is_platform_admin()` inside SECURITY DEFINER functions. Regular RLS policies on business tables are not modified.

2. **API layer**: No direct table access from the admin UI. All admin queries go through named RPCs that check admin status internally and log the access.

3. **Frontend layer**: Route guard that checks admin status before rendering. This is a UX convenience, not a security control — the real enforcement is at layers 1 and 2.

### Why not modify existing RLS policies

Adding `OR is_platform_admin()` to every existing RLS SELECT policy is simpler to write but harder to audit and maintain. It would mean:
- 20+ policies would need updating
- Any future policy addition must remember to include the admin escape hatch
- A bug in `is_platform_admin()` silently exposes all data

SECURITY DEFINER RPCs are a tighter surface. Each function that exposes cross-org data is explicitly named, explicitly audited, and explicitly maintained.

---

## 25.2 — Database: `platform_admins` Table

```sql
CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes   TEXT
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can check whether they are a platform admin
-- (needed by the frontend guard and by RPCs that call is_platform_admin())
CREATE POLICY "platform_admins_self_select" ON platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- No INSERT or DELETE via the API; manage via service role / direct DB only
```

**Important:** The first platform admin row must be inserted directly in the Supabase dashboard or via a one-time migration that seeds a specific user ID. There is intentionally no API to grant platform admin status from within the application.

### Helper Function

```sql
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$;
```

---

## 25.3 — SECURITY DEFINER RPCs

All admin data access goes through these functions. Each function:
1. Checks `is_platform_admin()` and returns an empty result set (not an error) if the caller is not an admin
2. Writes an entry to `audit_logs` recording that the admin performed this query
3. Returns only the fields needed by the UI — no raw joins that could leak unexpected data

### `admin_list_orgs()`

Returns all organisations with basic metrics.

```sql
CREATE OR REPLACE FUNCTION admin_list_orgs()
RETURNS TABLE (
  org_id         UUID,
  org_name       TEXT,
  org_type       TEXT,
  created_at     TIMESTAMPTZ,
  member_count   BIGINT,
  property_count BIGINT,
  task_count     BIGINT,
  last_activity  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  -- Log the access
  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- platform-level sentinel org_id
    auth.uid(),
    'platform',
    auth.uid(),
    'admin.orgs.listed',
    jsonb_build_object('timestamp', now())
  );

  RETURN QUERY
  SELECT
    o.id                                             AS org_id,
    o.name                                           AS org_name,
    o.org_type::TEXT                                 AS org_type,
    o.created_at                                     AS created_at,
    COUNT(DISTINCT om.user_id)                       AS member_count,
    COUNT(DISTINCT p.id)                             AS property_count,
    COUNT(DISTINCT t.id)                             AS task_count,
    MAX(GREATEST(
      COALESCE(t.updated_at, t.created_at),
      COALESCE(p.updated_at, p.created_at)
    ))                                               AS last_activity
  FROM organisations o
  LEFT JOIN organisation_members om ON om.org_id = o.id
  LEFT JOIN properties p  ON p.org_id = o.id
  LEFT JOIN tasks t       ON t.org_id = o.id
  GROUP BY o.id, o.name, o.org_type, o.created_at
  ORDER BY o.created_at DESC;
END;
$$;
```

**Note on the sentinel `org_id`:** `audit_logs.org_id` is NOT NULL. Platform-level actions do not belong to any org. Use a fixed well-known UUID (`00000000-0000-0000-0000-000000000000`) that does not correspond to a real organisation. Add a comment in the migration. Alternatively, make `org_id` nullable in a migration and handle it at the RLS layer — but the sentinel is simpler and avoids a schema change.

### `admin_get_org(p_org_id UUID)`

Returns detailed information about one organisation.

```sql
CREATE OR REPLACE FUNCTION admin_get_org(p_org_id UUID)
RETURNS TABLE (
  org_id       UUID,
  org_name     TEXT,
  org_type     TEXT,
  created_at   TIMESTAMPTZ,
  created_by   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(), 'organisation', p_org_id, 'admin.org.viewed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT o.id, o.name, o.org_type::TEXT, o.created_at, o.created_by
  FROM organisations o WHERE o.id = p_org_id;
END;
$$;
```

### `admin_list_org_members(p_org_id UUID)`

Returns all members of an org with their role and last auth event.

```sql
CREATE OR REPLACE FUNCTION admin_list_org_members(p_org_id UUID)
RETURNS TABLE (
  user_id    UUID,
  email      TEXT,
  role       TEXT,
  joined_at  TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(), 'organisation', p_org_id, 'admin.org.members.listed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT
    om.user_id,
    au.email,
    om.role,
    om.created_at AS joined_at,
    au.last_sign_in_at
  FROM organisation_members om
  JOIN auth.users au ON au.id = om.user_id
  WHERE om.org_id = p_org_id
  ORDER BY om.created_at DESC;
END;
$$;
```

### `admin_get_org_activity(p_org_id UUID, p_limit INT DEFAULT 50)`

Returns recent audit log entries for an org.

```sql
CREATE OR REPLACE FUNCTION admin_get_org_activity(p_org_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id          UUID,
  actor_id    UUID,
  entity_type TEXT,
  entity_id   UUID,
  action      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(), 'organisation', p_org_id, 'admin.org.activity.viewed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT al.id, al.actor_id, al.entity_type, al.entity_id, al.action, al.metadata, al.created_at
  FROM audit_logs al
  WHERE al.org_id = p_org_id
  ORDER BY al.created_at DESC
  LIMIT LEAST(p_limit, 200); -- hard cap
END;
$$;
```

### `admin_get_org_ai_requests(p_org_id UUID, p_limit INT DEFAULT 100)`

Returns recent AI request records for an org (from the `ai_requests` table created in Phase 1).

```sql
CREATE OR REPLACE FUNCTION admin_get_org_ai_requests(p_org_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  function_name TEXT,
  model_used    TEXT,
  provider      TEXT,
  status        TEXT,
  latency_ms    INT,
  cost_usd      NUMERIC,
  input_tokens  INT,
  output_tokens INT,
  entity_type   TEXT,
  entity_id     UUID,
  error_message TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(), 'organisation', p_org_id, 'admin.org.ai_requests.viewed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT
    r.id, r.user_id, r.function_name, r.model_used, r.provider,
    r.status, r.latency_ms, r.cost_usd, r.input_tokens, r.output_tokens,
    r.entity_type, r.entity_id, r.error_message, r.created_at
  FROM ai_requests r
  WHERE r.org_id = p_org_id
  ORDER BY r.created_at DESC
  LIMIT LEAST(p_limit, 500);
END;
$$;
```

---

## 25.4 — Frontend Route Structure

```
/admin                     AdminLayout (guard, sidebar)
/admin/orgs                AdminOrgList
/admin/orgs/:orgId         AdminOrgDetail
/admin/orgs/:orgId/ai      AdminOrgAiRequests
```

All routes render inside `AdminLayout`, which:
1. Checks platform admin status via `useIsPlatformAdmin()`
2. Redirects to `/` with no error message if not admin (do not reveal that `/admin` exists)
3. Renders the admin chrome (sidebar nav, breadcrumb, page title) if admin

### Guard Hook

```typescript
// src/hooks/admin/useIsPlatformAdmin.ts
export function useIsPlatformAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['platform-admin-check', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) return false;
      return data !== null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Route Registration in `src/App.tsx`

Admin routes are lazy-loaded and registered in the same router configuration as all other routes. The guard is inside the component tree, not at the router level — this is consistent with the existing pattern where the Identity Gate and Org Gate are component-level guards, not route-level middleware.

```typescript
const AdminLayout       = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOrgList      = lazy(() => import('./pages/admin/AdminOrgList'));
const AdminOrgDetail    = lazy(() => import('./pages/admin/AdminOrgDetail'));
const AdminOrgAiRequests = lazy(() => import('./pages/admin/AdminOrgAiRequests'));
```

---

## 25.5 — Page Specifications

### `AdminLayout`

**Purpose:** Outer shell for all admin pages. Contains the admin guard.

**Behaviour:**
- On mount, calls `useIsPlatformAdmin()`. Shows a loading skeleton while the query resolves.
- If not admin, calls `navigate('/')` silently (no toast, no error message).
- If admin, renders the page with an admin-specific nav bar.

**Admin nav items:**
- Organisations (→ `/admin/orgs`)
- No other items in Phase 2

**Visual treatment:** Use a distinct but subdued visual indicator that differentiates admin views from regular app views. A thin teal top border or an "INTERNAL" badge in the nav is sufficient. Do not make it dramatic — admin views should feel like a calm operational tool, not a power mode.

---

### `AdminOrgList`

**Purpose:** Top-level view of all organisations on the platform.

**Data source:** `admin_list_orgs()` RPC

**Columns in the table:**

| Column | Source | Notes |
|---|---|---|
| Organisation name | `org_name` | Clickable, links to `/admin/orgs/:orgId` |
| Type | `org_type` | `personal`, `business`, `contractor` — display as a Chip |
| Members | `member_count` | Integer |
| Properties | `property_count` | Integer |
| Tasks | `task_count` | Integer |
| Last activity | `last_activity` | Relative time (`2h ago`) |
| Created | `created_at` | Date only |

**Interactions:**
- Row click → navigate to `/admin/orgs/:orgId`
- Search: client-side filter on `org_name` (no server call needed — expected org count is small)
- Sort: client-side on any column

**Empty state:** If no orgs returned (which means no platform admin role), render nothing — the guard will have already redirected.

---

### `AdminOrgDetail`

**Purpose:** Full detail view for one organisation.

**Data sources (parallel fetch on mount):**
- `admin_get_org(orgId)` — org metadata
- `admin_list_org_members(orgId)` — member list
- `admin_get_org_activity(orgId, 50)` — recent activity

**Layout:** Three sections stacked vertically.

**Section 1: Org Header**
- Org name, type badge, created date, member count
- Link: "View AI Requests" → `/admin/orgs/:orgId/ai`

**Section 2: Members**

Table columns:

| Column | Source |
|---|---|
| Email | `email` |
| Role | `role` — display as Chip |
| Joined | `joined_at` — relative time |
| Last sign in | `last_sign_in_at` — relative time, "Never" if null |

No actions. Read-only.

**Section 3: Recent Activity**

Activity feed from `audit_logs`. Display as a timeline list (not a table).

Each entry shows:
- `action` — formatted as a human-readable label (see mapping below)
- `entity_type` + `entity_id` — shown as `compliance_document · abc123...` (truncated UUID)
- `created_at` — relative time
- `actor_id` — show email if available (join against member list fetched in Section 2)

**Action label mapping** (client-side lookup, not a DB concern):

```typescript
const ACTION_LABELS: Record<string, string> = {
  'ai.doc.analysed':          'Document analysed by AI',
  'ai.extract.completed':     'AI task extraction completed',
  'ai.image.analysed':        'Image analysed by AI',
  'assistant.action.executed': 'Assistant action executed',
  'compliance.scheduled':     'Compliance item scheduled',
  // extend as new events are added
};
```

Unmapped actions display the raw `action` string in monospace.

---

### `AdminOrgAiRequests`

**Purpose:** AI request log for a specific organisation. Primarily used for debugging failed AI operations and reviewing cost concentration.

**Data source:** `admin_get_org_ai_requests(orgId, 100)` RPC

**Table columns:**

| Column | Source | Notes |
|---|---|---|
| Function | `function_name` | Monospace |
| Model | `model_used` | Monospace |
| Status | `status` | Chip: `success`=teal, `error`=coral, `timeout`=amber, `fallback`=muted |
| Latency | `latency_ms` | `240ms` format |
| Cost | `cost_usd` | `$0.000142` format; `—` if null |
| Tokens in/out | `input_tokens` / `output_tokens` | `1,240 / 380` |
| Entity | `entity_type` + `entity_id` | `compliance_document · abc123` |
| Error | `error_message` | Truncated to 60 chars; expandable on row click |
| Time | `created_at` | Relative time |

**Filters (client-side):**
- Status: all / success / error / timeout / fallback
- Function name: dropdown of unique values in current result set

**Row expansion:** Click a row to see full `error_message` and `metadata` JSONB rendered as a collapsible JSON viewer.

**No "re-run" capability in Phase 2.** That requires Phase 3 (AI Gateway) to be in place first.

---

## 25.6 — What the Admin Panel Must NOT Do in Phase 2

These are hard boundaries, not suggestions. Document them here so they are not accidentally included during implementation.

- No INSERT, UPDATE, or DELETE on any business table from the admin UI
- No impersonation (reading or writing as another user)
- No access to `auth.users` raw table — only the fields returned by the RPCs above
- No access to documents, images, or file storage
- No sending emails or messages to users
- No access to billing or payment data (not yet in the schema)
- No ability to delete an organisation or user

---

## 25.7 — Sentinel Org ID for Platform-Level Audit Logs

`audit_logs.org_id` is `NOT NULL REFERENCES organisations(id)`. Platform admin actions do not belong to any org. Rather than making `org_id` nullable (a schema change that touches RLS everywhere), insert a single sentinel row into `organisations`:

```sql
INSERT INTO organisations (id, name, org_type, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '_platform',
  'business',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;
```

The `created_by` foreign key references `auth.users(id)`. The zero UUID does not exist in `auth.users`. Two options:
1. Use `ON DELETE SET NULL` on `created_by` in `organisations` — check if the current schema already allows this
2. Drop the FK on `created_by` for this sentinel row only — not possible in Postgres without a deferrable constraint

**Recommended:** Check the actual `organisations` migration. If `created_by` has a FK to `auth.users`, the sentinel insert will fail. In that case, make `audit_logs.org_id` nullable via a new migration and update the RLS policy to handle `NULL` org_id as platform-only access. This is a single-line migration and a single-line policy update — it is cleaner than a fake org row.

The implementation team should resolve this based on the actual FK constraints when writing the migration.

---

## 25.8 — Deliverables Checklist

### Database (one migration file)

- [ ] `create_platform_admins.sql` — table, RLS, `is_platform_admin()` function, sentinel org row (or nullable `org_id` migration — see §25.7)
- [ ] `create_admin_rpcs.sql` — all five SECURITY DEFINER functions from §25.3

### Frontend

- [ ] `src/hooks/admin/useIsPlatformAdmin.ts`
- [ ] `src/hooks/admin/useAdminOrgList.ts` — wraps `admin_list_orgs()` RPC call
- [ ] `src/hooks/admin/useAdminOrg.ts` — wraps `admin_get_org()`, `admin_list_org_members()`, `admin_get_org_activity()` in parallel
- [ ] `src/hooks/admin/useAdminOrgAiRequests.ts` — wraps `admin_get_org_ai_requests()`
- [ ] `src/pages/admin/AdminLayout.tsx`
- [ ] `src/pages/admin/AdminOrgList.tsx`
- [ ] `src/pages/admin/AdminOrgDetail.tsx`
- [ ] `src/pages/admin/AdminOrgAiRequests.tsx`
- [ ] Admin routes registered in `src/App.tsx`

### Types

- [ ] Supabase types regenerated after migrations run (RPCs will appear in types)

### Docs

- [ ] `@Docs/03_Data_Model.md` updated to include `platform_admins`

---

## 25.9 — Dependency on Phase 1

The `AdminOrgAiRequests` page requires `ai_requests` to exist (Phase 1, §24.2). If Phase 2 is implemented before Phase 1 is fully complete:

- The `admin_get_org_ai_requests()` RPC will fail to compile if `ai_requests` does not exist
- The migration file ordering must ensure `create_ai_requests.sql` runs before `create_admin_rpcs.sql`

The remaining admin pages (`AdminOrgList`, `AdminOrgDetail`) have no dependency on Phase 1 and can be built concurrently with Phase 1 work, provided the RPC migrations are ordered correctly.
