# CHAPTER 20 — BILLING & ENTITLEMENTS

STATUS: CANONICAL

This chapter is the source of truth for commercial packaging, entitlements, usage meters and billing-state behaviour.

Roles, assignments and effective-access evaluation: `@Docs/02_Identity.md`.  
Phased engineering rollout: `@Docs/28_Billing_Implementation_Plan.md`.

---

## 20.0 — FOUR INDEPENDENT CONCEPTS

These are related but must remain technically independent:

1. **Plans** — which product capabilities an organisation has purchased.
2. **Usage allowances** — variable-cost resources (evidence storage, AI, premium messaging).
3. **Roles** — what a member is permitted to do (`02_Identity`).
4. **Assignments** — which properties, tasks and records that member can access.

Application code MUST NOT use logic such as:

```text
if plan == "family"
if plan == "manager"
if plan == "business"
```

Evaluate explicit **entitlements** and **permissions** instead.

---

## 20.1 — PUBLIC PLANS

| Plan | Buyer statement | Primary scope |
|---|---|---|
| **Home** (free) | “I manage my own home.” | 1 active property, 1 coordinating member |
| **Home Plus** | “Other people help me manage my home.” | 1 active property, coordinating + Staff collaboration |
| **Portfolio** | “I coordinate operations across several properties.” | Property bands, multi-property ops |
| **Business** | “We govern property operations across teams and locations.” | Governance, compliance depth, admin controls |

**Enterprise** is not a fifth public pricing card. It is a negotiated Business contract (SLA, residency, legal hold, custom security, migration, training, volume overrides).

### Parallel track — Contractor (not a consumer pricing card)

| Track | Meaning |
|---|---|
| **Contractor Free** | Token / link access to a single shared task (existing contractor token model). |
| **Contractor Pro** | Contractor organisation SaaS; upload-only into client organisations. |

External contributors (Chapter 2) cover occasional submitters. They do **not** replace Contractor Pro workspaces.

### org_type ↔ plan family

| org_type | Plan family |
|---|---|
| `personal` | Home, Home Plus |
| `business` | Portfolio, Business |
| `contractor` | Contractor Free / Contractor Pro |

`org_type` does not imply a paid subscription. Entitlements do.

### Plan boundaries

* Home cannot invite a second coordinating member or add a second active property without upgrade.
* Home Plus is collaboration on **one** property — not a second permission model.
* Second active property → Portfolio (Home Plus cannot remain).
* Portfolio with a single active property is not a valid steady state (downgrade to Home Plus or add properties).
* Business is differentiated by **governance**, not merely higher property counts.

### Suggested included scope (commercial defaults; numbers tunable)

**Home**

* 1 active property; 1 coordinating member
* Core tasks, checklists, basic evidence, basic signals
* Small evidence allowance; limited AI allowance if offered
* Self-service support; standard retention

**Home Plus**

* 1 active property; small coordinating-member pack
* Staff contributor allowance; external submissions
* Larger evidence allowance; longer operational history
* Standard support

**Portfolio**

* Property bands (e.g. 2–5, 6–15, 16–40, higher by agreement)
* Coordinating seats included per band (avoid double-charging growth)
* Pooled Staff, evidence and AI allowances
* Multi-property navigation, portfolio views, property assignments
* Operational reporting; basic compliance; selected integrations
* Priority support resources

**Business**

* Teams/regions; approval workflows; advanced compliance
* Advanced audit export; configurable retention; advanced reporting
* API / integrations; centralised administration; SSO/provisioning where justified
* Onboarding options; priority support; contractual limits and add-ons

---

## 20.2 — VALUE METRICS

### Primary: active properties

A property counts when it is **active** and available for current operations.

Recommended rules:

* Active properties count toward the subscribed limit.
* Archived properties remain accessible, do not receive new operational records, and do not count (subject to archival policy).
* Define trial, delete lag, seasonal pause and band-reduction behaviour explicitly in implementation.
* Anti-abuse controls for frequent archive/reactivate patterns.

### Secondary: coordinating members

Usually Owner and Manager. Plans include a seat pack; additional seats are add-ons.

Exclude from coordinating seat count: unaccepted invitations, suspended/deleted members, billing-only contacts without product access. Inactive coordinating-member treatment must be explicit.

### Controlled operational resources (not primary pricing headline)

* **Monthly active Staff** — meter qualifying activity in the billing period (prefer complete item / add evidence / operational message / meaningful assigned-work open — not “signed in” alone). Generous included allowance; contributor packs for overage.
* **External contributors** — prefer secure task links, expiring invitations, evidence/issue forms; attributable and auditable; not coordinating seats.
* **Evidence / files** — organisation-pooled bytes (images, video, PDFs, derivatives). Optimize uploads; stronger video limits; cold storage for old originals; warn before limits; never block access to **existing** files solely for overage; block or pack **new** uploads.
* **AI operations** — plan allowances; core manual workflows continue when exhausted; existing AI results remain; add-on or explicit overage agreement.
* **Premium messaging** — SMS, WhatsApp, voice, high-volume transactional email: allowance, pack or direct usage. Push/normal email within reasonable use.

---

## 20.3 — ENTITLEMENT ENGINE

Code checks **capabilities / entitlements**, not plan names.

Examples:

* `multi_property_enabled`
* `compliance_enabled`
* `advanced_reports_enabled`
* `api_enabled`
* `external_submissions_enabled`
* `can_add_staff` / coordinating and Staff seat allowances
* Numeric meters: `active_properties_limit`, `coordinating_seats_limit`, `staff_active_monthly_allowance`, `evidence_bytes_allowance`, `ai_ops_allowance`

Entitlement sources: plan, add-on, trial, time-bounded admin override (audited).

Core entities (implementation target):

* **Subscription** — org, plan id, status, period, renewal, grace, external billing refs
* **Entitlement** — capability key, enabled/allowance, source, effective dates
* **Usage counter** — org, meter, period, quantity
* **Membership** — org, user, role, billing seat type, status
* **Assignment** — member ↔ property/task/resource

---

## 20.4 — CORE LOOP MUST SURVIVE COMMERCIAL RESTRICTIONS

Filla must **never** gate the core operational loop for people doing assigned work:

* View assigned work
* Complete tasks and checklists
* Add necessary evidence
* Communicate about assigned work
* Access previously submitted records

Billing limitations should prevent **expansion** before they interrupt active operations.

When over limit or in payment failure (after grace), Filla may prevent:

* Adding properties
* Inviting additional coordinating members
* Starting new premium automations
* Consuming additional AI allowance
* Premium reporting
* Creating new records beyond contractual limits
* New evidence uploads beyond allowance (existing files remain readable)

Preserve: existing assigned work, completion, required evidence submission, existing data access, export, billing remediation.

---

## 20.5 — SUPPORT MODEL

| Plan | Included support |
|---|---|
| Home | Knowledge base, guided UX, automated help, standard email |
| Home Plus | Standard email support |
| Portfolio | Priority email/chat and guided setup material |
| Business | Priority support and administrator onboarding |
| Enterprise contract | SLA, named contact, agreed escalation |

Paid services (normally): bespoke migration, bulk import cleanup, customised onboarding, live training, workflow consulting, custom integrations, on-site implementation.

Support entitlements define response targets, not instant resolution.

---

## 20.6 — BILLING FAILURE AND DOWNGRADE

**Supersedes prior “entire organisation Read-Only” default.**

Recommended sequence:

1. Payment attempt fails.
2. Notify billing contacts.
3. Enter a grace period — **existing operational work continues**.
4. After grace: prevent expansion (properties, seats, premium variable-cost consumption).
5. Disable premium variable-cost services if necessary.
6. Preserve export and billing access.
7. On plan downgrade below current usage: ask which resources remain active; soft-archive the rest.
8. Retain archived data per lifecycle policy (`21_Data_Lifecycle.md`). Never silently delete.

Full organisation read-only (or harder lockdown) is reserved for **security / fraud / abuse**, not ordinary non-payment.

Data is soft-archived on commercial downgrade paths; never immediately deleted.

---

## 20.7 — FREE-PLAN SAFEGUARDS

Home (free) supports adoption without unlimited liability:

* Verified email
* One active property; one coordinating member
* Small upload allowance; strong video restrictions
* Limited AI; invitation/submission rate limits
* Automated abuse detection; self-service support
* Standard archive/deletion policies with advance warning and export opportunity

Never unexpectedly delete customer data.

---

## 20.8 — UPGRADE MOMENTS

| Customer action | Response |
|---|---|
| Invite second coordinating person on Home | Offer Home Plus |
| Add second property | Offer Portfolio |
| Exceed coordinating seats | Seat add-on |
| Exceed active Staff allowance | Contributor pack |
| Approach evidence allowance | Usage + storage add-on |
| Reach AI allowance | Keep manual workflows; offer AI add-on |
| Need advanced governance | Offer Business |
| Need SLA / residency / custom security | Enterprise conversation |

Do not show generic upgrade walls without a clear cause.

---

## 20.9 — PRICING-PAGE COMMUNICATION

Emphasise:

1. Properties  
2. Included coordinating members  
3. Collaboration model  
4. Major workflow capabilities  
5. Support level  

Disclose storage, AI and messaging allowances in expandable details — not as the main table.

---

## 20.10 — PRODUCT PROMISE

> Filla will not penalise people for completing assigned work, while organisations that create substantial coordination, storage, automation or support costs pay in proportion to the value and resources they consume.
