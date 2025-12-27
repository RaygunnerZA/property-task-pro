# CHAPTER 2 — Identity & Organisation System

**1. PURPOSE**
The Identity & Organisation backbone determines what mode a user sees, what properties they access, and how RLS is enforced.

**2. THE TWO AXES: Identity vs Role**
*   **Identity (UX Mode):** Personal, Manager, Staff, Contractor, Contractor Pro.
*   **Role (Permissions):** Owner, Manager, Member, Staff.

**3. ORGANISATION MODEL**
*   `organisations`: id, name, org_type (personal|business|contractor).
*   `organisation_members`: user_id, org_id, role, assigned_properties.

**4. MULTI-ORG SUPPORT**
Users have an `active_org_id` in their session. All queries filter by this ID.

**5. INVISIBLE ORG (PERSONAL MODE)**
"I manage my own home" creates a `personal` org where the user is Owner.

**6. JWT CLAIMS**
Tokens contain: `identity_type`, `active_org_id`, `org_roles`, `assigned_properties`.

**7. SESSION HYDRATION**
1. Read JWT -> 2. Resolve Org -> 3. Load Memberships -> 4. Resolve Identity -> 5. Derive Permissions.

**8-13. GATES & FLOWS**
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