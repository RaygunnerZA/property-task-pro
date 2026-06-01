# CHAPTER 2 — Identity & Organisation System


STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.

1. PURPOSE
The Identity & Organisation backbone determines what data a user can access, what capabilities they can perform, and how organisation-scoped security is enforced.

Identity provides context.

Roles provide permissions.

Capabilities determine visible functionality.

⸻

2. THE THREE AXES: Identity, Role and Experience

Identity

Identity determines:

* Which organisations a user belongs to
* Which properties they can access
* Which organisation is active
* Which data is visible through RLS

Identity does not determine navigation structure.

⸻

Role

Roles determine:

* Permissions
* Access rights
* Available actions

Examples:

* Owner
* Manager
* Member
* Staff

⸻

Experience

Filla uses progressive complexity.

All users operate within the same platform.

The platform reveals capabilities according to responsibility.

Examples:

* Cleaners primarily see work, checklists and evidence capture.
* Technicians additionally see assets and maintenance context.
* Property managers see coordination, compliance and operational oversight.
* Portfolio managers see reporting, trends and intelligence.

The underlying platform remains the same.

⸻

3. ORGANISATION MODEL

* organisations: id, name, org_type (personal|business|contractor).
* organisation_members: user_id, org_id, role, assigned_properties.

⸻

4. ACTIVE ORGAN (CANONICAL FOR DATA)

The org that gates all org-scoped queries and RLS-backed reads is not inferred from JWT app_metadata.org_id alone. The app resolves it from organisation_members (see useActiveOrg / ActiveOrgProvider): first membership in created_at order, preferring a non-personal org when one exists.

* DataContext.orgId matches that same membership resolution (provider order: ActiveOrgProvider wraps DataProvider).
* JWT may still carry org_id for Supabase triggers and legacy paths; it must not be the only source for UI data loading. In development, if JWT org_id and membership orgId both exist and differ, the app logs a console warning.

⸻

5. MULTI-ORG SUPPORT

Users may belong to multiple organisations.

The active organisation determines which organisation’s rows are visible.

Switching organisation must invalidate dependent queries and reload organisation-scoped data.

⸻

6. INVISIBLE ORG (PERSONAL MODE)

“I manage my own home” creates a personal organisation where the user is Owner.

Personal organisations follow the same rules as all other organisations.

⸻

7. JWT CLAIMS

Tokens may contain:

* identity_type
* org_id
* active_org_id
* org_roles
* assigned_properties
* contractor_token

Use claims for authentication and contractor access.

Use useActiveOrg and DataContext.orgId as the source of truth for data loading.

⸻

8. SESSION HYDRATION

1. Read session (JWT)
2. Resolve user id
3. Load active organisation from organisation_members
4. Fetch organisation row
5. Derive permissions from membership role
6. Resolve visible capabilities

⸻

8a. PREFERRED HOOKS (APPLICATION CODE)

* Org-scoped data, query keys, guards: use useActiveOrg() or useOrgScope().
* Active org id + organisation display row: useOrg() from @/contexts/DataContext.
* Legacy aliases (deprecated):
    * useCurrentOrg()
    * useFillaIdentity()

New code should use:

* useActiveOrg
* useOrgScope
* useOrg
* useDataContext

⸻

9. GATES & FLOWS

* Identity Gate: Blocks access until identity is known.
* Organisation Gate: Ensures membership exists.
* Staff: Restricted to assigned properties.
* Contractor Free: Token-based access to a single task.
* Contractor Pro: Full access to contractor organisation; upload-only access to client organisations.

⸻

19. IDENTITY SHAPES CONTEXT, NOT NAVIGATION

Identity determines:

* Which organisations are visible
* Which properties are accessible
* Which actions are permitted
* Which capabilities are available
* Which context layers are visible

Identity does not directly determine navigation.

⸻

Navigation

Navigation describes activity.

Examples:

* Home
* My Work
* Calendar
* Properties
* Knowledge
* Reports

Not every role sees every activity area.

Navigation should remain as consistent as possible across users.

⸻

Scope

Property selection determines scope.

Examples:

* All Properties
* The Bird
* Pelican House

Changing scope filters activity areas.

Scope should never create duplicate navigation structures.

Bad:

Properties
→ The Bird
→ Tasks

while also having:

My Work

Good:

My Work

filtered by:

The Bird

⸻

Core Principle

A cleaner and a property manager may access the same Asset.

The structure of the Asset remains consistent.

Permissions, capabilities and available actions change according to role.

The platform remains the same.