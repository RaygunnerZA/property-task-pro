# Admin panel — cursor / keyset pagination (design)

**Status:** **Shipped** for `admin_get_org_activity` and `admin_get_org_ai_requests` (migration `20260515000001_admin_activity_ai_requests_cursor.sql`). `admin_list_orgs` unchanged unless row counts justify it later.  
**Spec parent:** [`25_Phase2_Admin_Panel_Spec.md`](./25_Phase2_Admin_Panel_Spec.md)

---

## Goals

- Avoid loading unbounded rows for **`admin_get_org_activity`** and **`admin_get_org_ai_requests`** as orgs grow.
- Keep **one audit log row per RPC invocation** (§25). Each “Load more” is a separate RPC call and therefore **its own** `audit_logs` row (`admin.org.activity.viewed` / `admin.org.ai_requests.viewed`). This matches §25’s per-invocation audit; if product later wants only the first page logged, gate the INSERT in a follow-up migration.

---

## Keyset pattern

Use **stable descending sort** on a tie-breaker:

- **Activity (`audit_logs`):** `ORDER BY created_at DESC, id DESC`
- **AI requests (`ai_requests`):** `ORDER BY created_at DESC, id DESC`

**Cursor** (client sends opaque or structured):

- Recommended: two query params **`p_after_created_at`** (`timestamptz`) + **`p_after_id`** (`uuid`), both nullable. First page: both `NULL`. Next page: pass the **last row’s** `(created_at, id)` from the previous response.

**RPC signature sketch:**

```sql
admin_get_org_activity(
  p_org_id uuid,
  p_limit int default 50,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
```

**WHERE clause (keyset “older than cursor”):**

```sql
WHERE al.org_id = p_org_id
  AND (
    p_after_created_at IS NULL
    OR (al.created_at, al.id) < (p_after_created_at, p_after_id)
  )
```

Use **row comparison** `(created_at, id) < (cursor_ts, cursor_id)` for strict ordering (PostgreSQL tuple comparison).

**Page size:** default **50**, hard cap **200** (already in §25 for activity). AI requests: default **100**, cap **500**.

**Return shape:** add optional **`has_more boolean`** — `true` when `LIMIT + 1` rows would exist (fetch `limit+1`, trim, set flag) **or** return `next_cursor` jsonb `{ "created_at", "id" }` on each page.

---

## `admin_list_orgs`

Org count is usually modest; **client-side filter/sort** may remain enough. If needed:

- Add **`p_after_created_at`** + **`p_after_id`** on **`organisations.created_at DESC, id DESC`**, or
- Offset pagination **only** for org list (simpler; admin-only; low risk) — prefer keyset for consistency.

---

## Frontend

- **`useAdminOrg` / `useAdminOrgAiRequests`:** `useInfiniteQuery` with `pageParam` = cursor tuple or serialized cursor.
- **UI:** “Load more” at section footers (`AdminOrgDetail`, `AdminOrgAiRequests`) before replacing client-only org list paging.

---

## Types & ordering

After RPC changes: **`supabase gen types`** and update `src/hooks/admin/*` + admin pages in the same release train.

**Revision:** bump this doc when the first migration ships.
