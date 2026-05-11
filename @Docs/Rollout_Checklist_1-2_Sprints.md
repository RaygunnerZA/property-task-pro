# Rollout checklist — 1–2 sprints (nothing missed)

**Active execution order / sprint focus:** [`Rollout_Execution_Plan.md`](./Rollout_Execution_Plan.md)

**Purpose:** Track delivery of the agreed backlog: strict TypeScript, admin scale, property hub data, `CreateTaskModal` decomposition, analytics consistency, error boundaries, docs discoverability, identity hook clarity, and observability follow-through.

**How to use:** Copy rows into your tracker (Linear/Jira). Set **Owner** before starting. Check **Verify** when merged. Do not skip **Dependencies** — order reduces rework.

**Legend — Effort:** S ≤ 1 day · M 2–3 days · L 4–5+ days (team-relative; adjust for your velocity).

---

## 0. Preconditions (once per program)

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| 0.1 | Confirm `@Docs` is canonical for schema/identity/observability; PRs that change enums or org behaviour update **03_Data_Model**, **02_Identity**, **24 / 25** as applicable | TBD | S | — | Doc PRs linked in release notes |
| 0.2 | CI runs **`npm test`** (Vitest scoped to `src`) + **`npm run build`** on every PR | TBD | S | `vite.config.ts` `test.include` | Green CI on `main` |
| 0.3 | **Manual matrix** after any `task_status` or org-identity change: vendor flow, manager task list, filters, badges, materialized views if touched | TBD | S | relevant PR | Checklist signed in PR description |

---

## Phase A — TypeScript strictness (incremental; do not block product on full completion)

**Rule:** One compiler/lint flag (or small cluster) per PR; keep CI green.

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| A.1 | Enable **`noUnusedLocals`** / **`noUnusedParameters`** (`tsconfig.app.json` + fix fallout) | TBD | M | 0.2 | `npm run build` green |
| A.2 | Enable **`noImplicitAny`**; replace latent `any` in `src/` (prioritise hooks, API boundaries) | TBD | L | A.1 | Build + spot grep `any` in touched paths |
| A.3 | Enable **`strictNullChecks`**; fix null/undefined contracts (largest bucket — may split by folder) | TBD | L | A.2 | Build green; critical paths smoke-tested |
| A.4 | Set **`"strict": true`** (or equivalent full strict bundle); burn down remainder | TBD | L | A.3 | Build green |
| A.5 | (Optional) ESLint **`@typescript-eslint/no-explicit-any`**: `warn` → `error` on `src/` after A.2 | TBD | S | A.2 | Lint job green |

---

## Phase B — Admin scale (server-side / cursor)

**Current state:** `AdminOrgList` uses **client-side** pagination (25/page). RPCs use **fixed limits** for activity / AI requests.

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| B.1 | **Design:** cursor/keyset strategy (`created_at`, `id`), page size defaults, max cap (align with §25 hard caps) | TBD | S | `@Docs/25_Phase2_Admin_Panel_Spec.md` | Written in PR / doc comment |
| B.2 | **Migrations / RPCs:** `admin_list_orgs` pagination (if row counts justify); **`admin_get_org_activity`** + **`admin_get_org_ai_requests`** cursor args + stable sort | TBD | L | B.1, `platform_admins` / sentinel already in DB | `supabase db push` (or CI) green; types regenerated |
| B.3 | **Types:** regenerate Supabase types after RPC signature changes | TBD | S | B.2 | `src/integrations/supabase/types.ts` updated in same PR |
| B.4 | **Hooks:** `useAdminOrgList`, `useAdminOrg`, `useAdminOrgAiRequests` — pass cursor, expose `hasNextPage` / `fetchNextPage` (or equivalent) | TBD | M | B.3 | Unit or manual: large fixture org |
| B.5 | **UI:** org list, org detail activity, AI requests — wire infinite scroll or “Load more”; remove redundant **client-only** paging if superseded | TBD | M | B.4 | Manual: no duplicate fetch storm; works with empty / single page |
| B.6 | **Audit:** each RPC still logs to `audit_logs` per §25; no new PII in analytics | TBD | S | B.2 | Spot-check `audit_logs` actions |

---

## Phase C — Property hub (timeline / drift / vendors)

**Current state:** `usePropertyTimeline`, `usePropertyDrift`, `usePropertyVendors` are **stubs**; not wired to property hub tabs.

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| C.1 | **Product decision per hook:** ship real data vs hide tab vs mark “Coming soon” (document in PR) | TBD | S | `@Docs/05_Task_Engine.md` / product | Decision recorded |
| C.2 | **Data model / RLS:** confirm queries only use documented columns (`03_Data_Model`); use **`useActiveOrg`** for `org_id` | TBD | M | C.1 | No invented columns; RLS-safe |
| C.3 | Implement **`usePropertyTimeline`** (org-scoped events: tasks, compliance, inspections — scope per product) | TBD | L | C.2 | Tab shows real data for test property |
| C.4 | Implement **`usePropertyDrift`** (or replace with `usePropertyDriftHeatmap` + copy if that’s the real source) | TBD | L | C.2 | Tab matches design; loading/error states |
| C.5 | Implement **`usePropertyVendors`** from real assignments / vendor tasks (per schema) | TBD | L | C.2 | Tab matches design |
| C.6 | **Wire** property hub / `[id]/page` tabs to C.3–C.5; remove stub imports | TBD | M | C.3–C.5 | Grep: no placeholder `useState` demo data left in those hooks |
| C.7 | **QA:** switch property, empty states, permission differences (staff vs manager) | TBD | S | C.6 | Matrix in PR |

---

## Phase D — `CreateTaskModal` decomposition

**Dependency:** Prefer after shared **create-task** mutation patterns are stable (already have `useCreateTaskMutation`).

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| D.1 | Inventory sections (form, AI/chips, footer, attachments) and map to existing `create/` subcomponents | TBD | S | — | Markdown or issue attachment |
| D.2 | Extract **container + state hook(s)** (e.g. `useCreateTaskModalState`) — no behaviour change | TBD | L | D.1 | Same E2E/manual flows; diff mostly moves files |
| D.3 | Extract **presentational** sections; keep **single** `mutateAsync` path to `useCreateTaskMutation` | TBD | L | D.2 | `task_created` still fires once with correct `source` |
| D.4 | (Optional) Lazy-load heavy subtrees to shrink initial bundle | TBD | M | D.3 | Build chunk report improved |

---

## Phase E — Analytics standardization (`@Docs/24`)

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| E.1 | Table in **24** §24.5: list each event vs **current** `track()` callsite | TBD | S | `@Docs/24_Phase1_Observability_Spec.md` | Gap list in ticket |
| E.2 | Move **`document_uploaded`** to mutation / upload hook `onSuccess` (not ad-hoc UI) | TBD | M | E.1 | PostHog/dev capture once per successful upload |
| E.3 | Move **`compliance_item_completed`** into a dedicated mutation hook `onSuccess` | TBD | M | E.1 | Same |
| E.4 | Align **`ai_task_generated`** with spec intent (document if edge vs mutation) | TBD | M | E.1 | Spec + code match; no double-fire |
| E.5 | Resolution / suggestion events (`resolutionAudit` paths): ensure properties match §24; no PII | TBD | M | E.1 | Review payload keys |
| E.6 | Grep guard: **`track(`** only in `src/lib/analytics.ts`, mutations, and explicitly documented exceptions | TBD | S | E.2–E.5 | `rg 'track\\(' src` reviewed in PR |

---

## Phase F — Error boundaries (remaining high-traffic routes)

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| F.1 | List **top 10 routes** by traffic / support tickets; mark which already wrapped | TBD | S | — | List in ticket |
| F.2 | Add **`ErrorBoundary`** + `regionTitle` + retry (invalidate React Query where applicable) per route group | TBD | M | F.1 | Forced throw in dev verifies isolated fallback |
| F.3 | **Work / Manage / Record** pillars: at least layout-level boundary if not per-page | TBD | M | F.2 | No white screen on child throw |

---

## Phase G — Docs discoverability (admin seed & identity)

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| G.1 | Pick **one entry doc** (e.g. `README.md` “Platform admin” section **or** `@Docs/00_Onboarding_Developers.md` if it exists) | TBD | S | — | Link merged |
| G.2 | Add **cross-links:** README ↔ `@Docs/25_Phase2_Admin_Panel_Spec.md` §25.2 / migration `20260511000001_*` comment | TBD | S | G.1 | New hire can find seed steps in ≤2 clicks |
| G.3 | Keep **`02_Identity`** + **`Roadmap_Tactical`** in sync when provider order or org rules change | TBD | S | Phase H | Any Phase H PR updates docs |

---

## Phase H — Identity API consolidation (single preferred consumer story)

**Current state:** Phase 4 aligned **`DataContext.orgId`** with **`useActiveOrg`**; `useOrgScope` / `useOrg` / `useFillaIdentity` still coexist.

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| H.1 | **Document** in `02_Identity`: recommended hook for **data fetch** (`useActiveOrg` / `useOrgScope`) vs **display** (`useOrg` for `organisation` name) | TBD | S | `@Docs/02_Identity.md` | PR approved by tech lead |
| H.2 | **Deprecate or narrow:** e.g. `@deprecated` JSDoc on redundant hooks; eslint import restriction (optional) | TBD | M | H.1 | Grep shows new code uses preferred pattern |
| H.3 | Migrate **highest-churn** files first (new PRs only if large migration deferred) | TBD | L | H.2 | No functional regression; dev warning still useful if JWT ≠ membership |

---

## Phase I — Observability / infra follow-through (easy to miss)

| # | Item | Owner | Effort | Dependencies | Verify |
|---|------|-------|--------|----------------|--------|
| I.1 | **`ai_requests`:** shared edge utility + batch rollouts per `@Docs/24` (if not already complete in repo) | TBD | L | migrations | Rows appear for hot functions |
| I.2 | **`ai_resolution_audit` RLS** migration + types in client if still absent | TBD | M | `@Docs/24` | Inserts succeed for member user |
| I.3 | Remove / guard any remaining **debug telemetry** in edge functions (§24 known bugs) | TBD | S | — | Grep `127.0.0.1` / ingest URLs in `supabase/functions` |

---

## Sign-off (before calling the program “done”)

- [ ] Phase A: at least **A.1–A.2** complete or consciously deferred with written risk acceptance  
- [ ] Phase B: **B.2–B.5** done **or** product accepts client-only admin until volume proof  
- [ ] Phase C: **all three** hooks real or tabs removed/hidden with product sign-off  
- [ ] Phase D: **D.2** done or ticket explicitly deferred with reason  
- [ ] Phase E: **E.2–E.4** addressed or exceptions documented in `@Docs/24`  
- [ ] Phase F: **F.2** covers agreed route list  
- [ ] Phase G: **G.2** cross-links live  
- [ ] Phase H: **H.1** merged; **H.2** started or waived  
- [ ] Phase I: triaged against actual `main` (close as N/A if already shipped)  
- [ ] **0.3** manual matrix executed after last schema/status/identity PR  

---

## Deferred (explicitly not in this checklist unless product pulls in)

- JWT advanced claims / multi-org **switcher** UX (only document invalidate strategy until built)  
- Admin **write** paths / impersonation (out of scope for §25 Phase 2)  
- Full **E2E automation** in CI (Playwright etc.) — add separate initiative if desired  

---

**Revision:** Update this file when scope changes. Last created for backlog alignment post–Phase 4 identity + Vitest/build fixes.
