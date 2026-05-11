# CHAPTER 2 — Identity & Organisation System

**1. PURPOSE**
The Identity & Organisation backbone determines what mode a user sees, what properties they access, and how RLS is enforced.

**2. THE TWO AXES: Identity vs Role**
*   **Identity (UX Mode):** Personal, Manager, Staff, Contractor, Contractor Pro.
*   **Role (Permissions):** Owner, Manager, Member, Staff.

**3. ORGANISATION MODEL**
*   `organisations`: id, name, org_type (personal|business|contractor).
*   `organisation_members`: user_id, org_id, role, assigned_properties.

**4. ACTIVE ORGAN (CANONICAL FOR DATA)**

The org that gates all org-scoped queries and RLS-backed reads is **not** inferred from JWT `app_metadata.org_id` alone. The app resolves it from **`organisation_members`** (see `useActiveOrg` / `ActiveOrgProvider`): first membership in `created_at` order, preferring a non-`personal` org when one exists.

*   **`DataContext.orgId`** matches that same membership resolution (provider order: `ActiveOrgProvider` wraps `DataProvider`).
*   **JWT** may still carry `org_id` for Supabase triggers and legacy paths; it must not be the only source for UI data loading. In development, if JWT `org_id` and membership `orgId` both exist and differ, the app logs a console warning.

**5. MULTI-ORG SUPPORT**

Users may belong to multiple orgs; the active org above determines which org’s rows are visible. Switching org (when the product adds a selector) must invalidate `["activeOrg", userId]` and dependent queries.

**6. INVISIBLE ORG (PERSONAL MODE)**

"I manage my own home" creates a `personal` org where the user is Owner.

**7. JWT CLAIMS**

Tokens may contain: `identity_type`, `org_id` / `active_org_id`, `org_roles`, `assigned_properties`, `contractor_token`, etc. **Use claims for contractor token and auth**, but treat **`useActiveOrg` / `DataContext.orgId`** as the source of truth for which organisation’s data to load.

**8. SESSION HYDRATION**

1. Read session (JWT) → 2. Resolve user id → 3. Load active org from `organisation_members` → 4. Fetch `organisations` row for display (name, etc.) → 5. Derive permissions from membership role.

**8a. PREFERRED HOOKS (APPLICATION CODE)**

*   **Org-scoped data, query keys, guards:** use **`useActiveOrg()`** or **`useOrgScope()`** (same membership-backed `org_id`). Do not derive the active org solely from JWT `app_metadata.org_id` for Supabase filters.
*   **Active org id + organisation display row:** **`useOrg()`** from `@/contexts/DataContext` — exposes membership-aligned `orgId` and loaded `organisation` (name, etc.).
*   **Thin convenience:** **`useFillaIdentity()`** — reads the same context fields; new feature code should still prefer **`useActiveOrg` / `useOrgScope`** for anything that touches `org_id` in RPCs or RLS-scoped tables.

**9. GATES & FLOWS**
*   **Identity Gate:** Blocks access until mode is known.
*   **Org Gate:** Ensures user belongs to active org.
*   **Staff:** Restricted to `assigned_properties`.
*   **Contractor Free:** Token-based access to single task.
*   **Contractor Pro:** Full access to own org; upload-only to client org.

**19. IDENTITY SHAPES NAVIGATION (NOT MENU STRUCTURE)**
Filla does not expose navigation based on abstract modes such as “Work” or “Manage”.
Identity determines:
• which entities are accessible
• which actions are permitted
• which context layers are visible

Navigation is entity- and context-driven, not role-driven.
Example: A staff user and a manager viewing the same Asset see the same context structure, but actions differ based on permissions.