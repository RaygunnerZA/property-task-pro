# CHAPTER 2 — Identity & Organisation System


STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.

Commercial plans, usage meters and downgrade behaviour live in `@Docs/20_Billing.md`.
Implementation phases live in `@Docs/28_Billing_Implementation_Plan.md`.

1. PURPOSE
The Identity & Organisation backbone determines what data a user can access, what capabilities they can perform, and how organisation-scoped security is enforced.

Identity provides context.

Roles provide permissions.

Assignments provide resource scope.

Plan entitlements (billing) further gate what the organisation may use — see Chapter 20.

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

Canonical membership roles:

* **Owner** — organisational control; at least one **Primary Owner** per organisation
* **Manager** — coordinate work on all or assigned properties
* **Staff** — perform assigned operational work

Restricted non-membership access:

* **External** — explicitly shared resources only (issue report, evidence submit, shared task). Prefer secure links / short-lived sessions over durable membership. Prefer the label **External** over “Guest” (property guests are a different concept).

Legacy:

* **`member`** — deprecated synonym for **Staff**. Existing rows and invitations may still use `member`; permission evaluation MUST treat `member` as Staff until data is migrated. New invites MUST use `staff` (or Owner/Manager). Do not introduce `member` in new product copy.

Do not invent additional durable roles at launch. Business overrides may later grant selected Manager capabilities; they do not create new role names.

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

`org_type` is an identity/tenant shape. It is **not** a billing plan name.

Mapping to commercial plan families (Chapter 20):

| org_type | Typical plan family |
|---|---|
| `personal` | Home, Home Plus |
| `business` | Portfolio, Business (Enterprise = negotiated Business) |
| `contractor` | Contractor Free (token) / Contractor Pro (SaaS) — parallel track |

Plans never replace `org_type`. Application code must not assume `org_type === "business"` means a paid Portfolio subscription.

⸻

3a. PRIMARY OWNER

Every organisation has exactly one **Primary Owner**.

* Controls organisation deletion and ownership transfer.
* Cannot leave or be demoted while still Primary Owner (transfer first).
* Other Owners (if ever allowed) do not receive destructive org controls by default.

Launch default: one Owner = Primary Owner. Multi-Owner is deferred.

⸻

3b. BILLING SEAT TYPE VS ROLE

Role ≠ billable seat. Seat types are commercial (Chapter 20):

| Seat / access type | Typical roles |
|---|---|
| Coordinating member | Owner, Manager |
| Staff contributor (active monthly) | Staff (and legacy `member`) |
| External contributor | External access — not a coordinating seat |

Billing meters organisations, never a user’s global identity across orgs. A person in three orgs is metered independently in each paying organisation.

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

“I manage my own home” creates a personal organisation where the user is Owner (Primary Owner).

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
5. Derive permissions from membership role (map legacy `member` → Staff)
6. Resolve visible capabilities from role ∩ plan entitlements ∩ assignments

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
* Organisation Gate: Ensures membership exists (External link sessions are exempt and scoped to shared resources only).
* Staff: Restricted to assigned properties / assigned work.
* External: Shared resources only; no organisation navigation.
* Contractor Free: Token-based access to a single task (parallel contractor track).
* Contractor Pro: Full access to contractor organisation; upload-only access to client organisations.

⸻

10. EFFECTIVE ACCESS

Authorization evaluates four layers:

> Effective access = plan entitlement ∩ role permission ∩ resource assignment ∩ valid resource state

* **Plan entitlement** — organisation purchased capabilities and allowances (`20_Billing`).
* **Role permission** — what the role may do (matrix below).
* **Resource assignment** — property/task/resource relationships (not a Boolean “all properties” capability alone).
* **Resource state** — active property, non-cancelled task, unexpired invitation/link, org not security-blocked.

UI visibility and API/RLS enforcement must use the same rules. Never check plan display names in feature code.

⸻

11. LAUNCH PERMISSION DEFAULTS

| Action | Owner | Manager | Staff | External |
|---|:---:|:---:|:---:|:---:|
| View assigned work | Yes | Yes | Yes | Shared only |
| Complete assigned work | Yes | Yes | Yes (assignee) | If link permits |
| Follow a task (watch / comment) | Yes | Yes | Yes | Shared only |
| Change task status or details as follower only | Yes | Yes | **No** | No |
| Complete checklists | Yes | Yes | Yes | If link permits |
| Add evidence | Yes | Yes | Yes | Shared only |
| Add comments | Yes | Yes | Yes | Shared only |
| Create tasks | Yes | Yes | **No** (default) | No |
| Report issue / intake | Yes | Yes | Yes | Shared only |
| Assign work | Yes | Yes | No | No |
| Manage properties | Yes | **No** (default); all-property Managers may be granted later | No | No |
| Invite Staff / External | Yes | **Yes** (Staff/External only) | No | No |
| Invite Managers / transfer Owner | Yes (Primary for transfer) | No | No | No |
| Manage roles | Yes | No | No | No |
| View operational reports | Yes | Yes | Limited (own work) | No |
| Manage compliance | Yes | Yes (if entitlement + scope) | No | No |
| Manage billing | Primary Owner (default) | No | No | No |
| Transfer ownership | Primary Owner | No | No | No |
| Delete organisation | Primary Owner | No | No | No |

Manager property scope:

* **Assigned-property Manager** (default when scoped): operate only on assigned properties.
* **All-property Manager**: operate across the organisation’s active properties when granted.

Staff must not discover unrelated properties. External participants must not navigate the organisation.

Business-tier administrative overrides may widen selected Manager capabilities later; they remain overrides, not new role names.

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
