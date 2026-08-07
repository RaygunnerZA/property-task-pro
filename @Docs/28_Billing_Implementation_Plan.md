# CHAPTER 28 — Billing, Roles & Entitlements Implementation Plan

STATUS: IMPLEMENTATION PLAN (defers to constitution)

Canonical product rules:

* `@Docs/02_Identity.md` — roles, assignments, effective access, launch permission defaults
* `@Docs/20_Billing.md` — plans, meters, entitlements, downgrade, contractor track

This chapter is the ordered engineering programme. Do not ship plan-name checks or blanket org read-only for ordinary non-payment.

---

## Amendments locked for build

| Decision | Rule |
|---|---|
| Public plans | Home · Home Plus · Portfolio · Business |
| Enterprise | Negotiated Business contract, not a fifth card |
| Contractor | Parallel track (Free token / Pro SaaS); keep beside consumer cards |
| org_type ↔ plans | personal→Home/Home Plus; business→Portfolio/Business; contractor→Contractor Free/Pro |
| Roles | Owner (Primary Owner), Manager, Staff, External |
| Legacy `member` | Treat as Staff; new invites use `staff` |
| Downgrade | Expansion-lock first; core ops continue; full read-only only for security/fraud |
| Launch permission optionals | Staff cannot create tasks by default; Manager invites Staff/External only; Manager does not manage properties/billing by default |
| Launch meters enforced | Active properties, coordinating seats |
| Launch meters observe-only first | Active Staff, evidence GB, AI ops |

---

## Phase 0 — Decisions and baseline measurement

### Objectives

Establish definitions and measure cost drivers before enforcing commercial limits.

### Product definitions to freeze

* Active property; archived property
* Coordinating member; monthly active Staff (qualifying actions)
* External contributor
* Evidence usage; AI operation
* Billing owner; Primary Owner
* Grace period; downgrade resource-selection behaviour

### Engineering

* Inventory plan-name checks and ad-hoc role checks
* Map storage and third-party services
* Add organisation-level usage instrumentation (observe mode)
* Cost attribution where possible
* Document current retention behaviour (`21_Data_Lifecycle.md` alignment)
* List operations that must remain available during billing restrictions (`20_Billing` §20.4)

### Deliverables

* Approved plan matrix (from Chapter 20)
* Approved role matrix (from Chapter 2 §11)
* Usage-definition document
* Cost-driver inventory
* Authorization audit; billing-state audit
* Initial unit-economics dashboard (even if manual)

### Exit criteria

* Every billable/limited resource has an unambiguous definition
* Current usage measurable without enforcement
* Product, finance and engineering agree on downgrade behaviour

---

## Phase 1 — Entitlement foundation

### Objectives

Remove direct dependency between plan names and application behaviour.

### Core entities

* Subscription, Entitlement, Usage counter, Membership (+ seat type), Assignment

### Engineering

* Central entitlement evaluator
* Server-side authorization service aligned with UI
* Audit events for entitlement and role changes
* Time-bounded admin overrides with reason
* Tests for entitlement ∩ role ∩ assignment ∩ state

### Exit criteria

* No core feature checks plan names directly
* Restricted actions enforced server-side
* Frontend visibility matches server authorization
* Overrides auditable and time-bounded

---

## Phase 2 — Roles and property scope

### Objectives

Implement four access models and scoped property access.

### Engineering

* Owner / Manager / Staff; External access path
* Primary Owner designation; prevent last-Primary-Owner removal
* Map legacy `member` → Staff permissions; stop new `member` invites
* All-property vs assigned-property Manager scopes
* Staff property/task assignments
* Secure external access; invitation expiry/revocation; membership suspension
* Role-change audit records

### UX

* Role descriptions in invite flow
* Accessible-properties summary
* “Why can’t I access this?” guidance
* Ownership-transfer confirmation
* External-link expiry/revocation controls

### Exit criteria

* Staff cannot discover unrelated properties
* External participants cannot navigate the organisation
* Ownership cannot be orphaned
* Role/scope changes consistent across product

---

## Phase 3 — Plans, property limits and seats

### Objectives

Launch commercial packaging without variable-cost overages.

### Engineering

* Configure Home, Home Plus, Portfolio, Business entitlements
* Count active properties and coordinating seats
* Count monthly active Staff (observe or soft-warn initially)
* Included seat packs + add-on packs
* Upgrade/downgrade transitions; billing-provider webhooks (idempotent)
* Grace-period handling per §20.6
* Billing administration permissions (Primary Owner default)

### UX

* Pricing / plan comparison
* Contextual upgrade prompts (`20_Billing` §20.8)
* Usage page; plan-change preview; proration explanation
* Downgrade resource-selection flow
* Payment-failure recovery

### Exit criteria

* Subscribe, upgrade and recover from payment failure
* No downgrade causes silent data loss
* Task completion remains available during ordinary billing restrictions
* Property and member counts reconcile with billing data

---

## Phase 4 — Evidence controls

### Objectives

Control the largest probable data-cost risk.

### Engineering

* File-size/type limits; image resize/compress; thumbnails/derivatives
* Video limits; stored + delivered bytes tracking
* Org-pooled evidence usage; malware scanning; archival lifecycle
* Alerts + storage packs; never revoke read of existing files for overage alone

### UX

* Upload restrictions before transfer; optimisation explanation
* Org usage + high-usage properties; warn before enforcement
* Export and add-on options

### Exit criteria

* Evidence cost measurable per org
* Large-file abuse limited
* Existing evidence accessible during overage
* Storage add-ons purchasable without changing core plan SKU

---

## Phase 5 — AI and premium messaging controls

### Objectives

Prevent unpredictable third-party usage costs.

### Engineering

* Product-level AI operations → internal cost units
* Allowances; pre/post accounting; rate limits; AI add-ons
* Email / SMS / premium-channel tracking; packs or agreed overage
* Service-failure fallbacks

### UX

* Understandable AI usage; warn before exhaustion
* Preserve manual alternatives
* Explicit approval for paid overages
* Explain premium-channel costs before activation

### Exit criteria

* AI exhaustion never blocks core manual work
* Usage visible before charges
* Expensive messaging cannot produce uncontrolled spend

---

## Phase 6 — Business governance

### Objectives

Defensible Business upgrade based on governance, not only higher limits.

### Engineering

* Approval workflows; advanced audit export; configurable retention
* Team/regional structure; advanced compliance; central policy controls
* API/integration administration; SSO/provisioning where justified
* Enterprise contract overrides via entitlements (not custom plan-name branches)

### Operational

* Business onboarding; support escalation; implementation pricing
* Security-review materials; SLA definitions

### Exit criteria

* Business offers materially stronger control
* Enterprise requirements configurable without custom plan logic
* Human services have defined scope and pricing

---

## Phase 7 — Optimization

### Objectives

Tune packaging from observed behaviour and contribution margin.

### Analysis

By plan and segment: conversion, upgrade triggers, churn, property/seat/Staff utilization, evidence/AI/support cost, contribution margin, limit frustration, add-on adoption.

### Adjustments

Included seats, Staff allowances, evidence/AI allowances, property bands, support entitlements, archive policies, add-on pricing.

Do not optimise solely for infrastructure cost — also measure impact on collaboration, completion and evidence quality.

---

## Required test scenarios

* Home: second property; second coordinating invite
* Home Plus: coordinating-seat limit
* Portfolio: property band change
* Staff assigned/unassigned; External link expired/revoked
* Primary Owner attempts to leave
* Payment fails during active work
* Downgrade below property count / seat count
* Evidence allowance mid-upload; AI allowance mid-workflow
* Add-on purchase; duplicate/out-of-order billing webhooks
* Subscription restored after grace
* Archived property reactivated
* Multi-org membership
* Data export / deletion request
* Legacy `member` receives Staff permissions

---

## Security requirements

* Server-side authorization for every protected action
* Short-lived external access; revocable invitations/links
* Audit for administrative and entitlement actions
* Malware scanning; signed file-access URLs
* Org-level isolation; rate limits
* Billing-webhook verification
* Restricted support impersonation
* Export and deletion workflows

---

## Launch sequence

1. Instrument current usage (Phase 0).
2. Introduce entitlements without changing customer access (Phase 1).
3. Migrate roles and assignments (Phase 2).
4. Launch plans and basic limits (Phase 3).
5. Evidence controls (Phase 4).
6. AI and messaging allowances (Phase 5).
7. Business governance (Phase 6).
8. Tune packages (Phase 7).

Limits initially run in **observe mode**: measure → warn internally → correct counting → notify customers → enforce only after confidence is high.

---

## Immediate next engineering tickets (Phase 0 kickoff)

1. Freeze usage definitions in a short appendix to this chapter or a linked sheet.
2. Audit codebase for plan-name and role-string branches; list gaps vs Chapter 2 §11.
3. Add org-level counters (properties active, members by role, storage estimate, AI request counts) — observe only.
4. Draft entitlement key catalogue matching `20_Billing` §20.3.
5. Constitution PR checklist: `02_Identity` + `20_Billing` reviewed by product before schema work.

---

## Appendix A — Frozen usage definitions (Phase 0)

These definitions are locked for observe-mode instrumentation and Phase 1 soft gates.

### Active property

A row in `properties` for the organisation where `is_archived` is false (or null treated as active).

* Counts toward `active_properties_limit`.
* Archived properties remain readable per lifecycle policy and do **not** count.

### Coordinating member

An `organisation_members` row whose normalized role is `owner` or `manager`.

* Counts toward `coordinating_seats_limit`.
* Unaccepted invitations do not count until membership exists.
* Suspended/deleted members do not count (when status exists).

### Staff contributor (headcount / monthly active)

* **Headcount (observe):** membership with normalized role `staff` (legacy `member` counts as Staff).
* **Monthly active Staff (observe later):** Staff/`member` who in the billing period completed a task item, added evidence, or sent an operational message. Sign-in alone does not qualify.
* Phase 0–1 refreshes headcount into `org_usage`; monthly-active is not enforced yet.

### External contributor

Link/token or short-lived session access to an explicitly shared resource. Not a coordinating seat. Not counted in `staff_count`.

### Home defaults (no `org_subscriptions` row)

When an organisation has no subscription row, resolve entitlements as **Home**:

| Key | Value |
|---|---|
| `active_properties_limit` | 1 |
| `coordinating_seats_limit` | 1 |
| `can_add_staff` | false |
| `multi_property_enabled` | false |
| `external_submissions_enabled` | false |
| `compliance_enabled` | false |
| `advanced_reports_enabled` | false |
| `api_enabled` | false |

Personal orgs without a paid plan use these defaults. Feature code must check entitlement keys, never plan display names.

### Entitlement key catalogue (Phase 1)

Boolean / numeric keys stored on `subscription_tiers.entitlements` (JSONB):

* `active_properties_limit` (number)
* `coordinating_seats_limit` (number)
* `staff_active_monthly_allowance` (number, observe)
* `can_add_staff` (boolean)
* `multi_property_enabled` (boolean)
* `external_submissions_enabled` (boolean)
* `compliance_enabled` (boolean)
* `advanced_reports_enabled` (boolean)
* `api_enabled` (boolean)
* `evidence_bytes_allowance` (number, observe)
* `ai_ops_allowance` (number, observe)
