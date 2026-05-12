# Rollout execution plan

**Master backlog:** [`Rollout_Checklist_1-2_Sprints.md`](./Rollout_Checklist_1-2_Sprints.md) — use that for owners, effort, and sign-off.

This file tracks **what we are doing now**, **order**, and **done** state so nothing is missed between sprints.

---

## Sprint 1 (completed)

**Theme:** Documentation discoverability + identity guidance + broad app-shell resilience (no schema changes).

| # | Task | Status | PR / notes |
|---|------|--------|------------|
| S1.1 | README cross-links → `@Docs`, rollout checklist, execution plan, platform admin seed | **Done** | README § Engineering |
| S1.2 | `@Docs/02_Identity.md` — “preferred hooks” for org-scoped code | **Done** | §8a |
| S1.3 | `AppLayout` — regional `ErrorBoundary` around all main `children` | **Done** | `AppLayout.tsx` |
| S1.4 | Link this plan from checklist header | **Done** | `Rollout_Checklist_1-2_Sprints.md` |

---

## Sprint 2 (completed) — Property hub

**Theme:** Real Insights data (timeline, drift, assignees) + invalidation wiring.

| # | Task | Status |
|---|------|--------|
| S2.1 | `usePropertyTimeline` + activity UI | **Done** |
| S2.2 | `usePropertyDrift` + `usePropertyVendors` + Insights sections | **Done** |

---

## Sprint 3 (completed)

**Theme:** Admin scale (cursor pagination) + analytics alignment (`track()` / §24.5).

| # | Task | Status | Notes |
|---|------|--------|-------|
| S3.1 | Phase **B.1** — Admin cursor/keyset pagination **design doc** | **Done** | [`25_Admin_Cursor_Pagination_Design.md`](./25_Admin_Cursor_Pagination_Design.md); Ch 25 cross-link |
| S3.2 | Phase **B.2–B.5** — RPC migrations + hooks + UI “Load more” | **Done** | `20260515000001_admin_activity_ai_requests_cursor.sql`; `useInfiniteQuery` + footers on org detail / AI requests |
| S3.3 | Phase **E.2** — `document_uploaded` from upload **mutation** `onSuccess` | **Done** | `use-file-upload.ts` uses `useMutation` |
| S3.4 | Phase **E.4–E.6** — `ai_task_generated` + resolution analytics + track allowlist test | **Done** | `useAIExtract` `confidence_avg`; `resolutionAudit` `suggestion_type`; `analyticsTrackInvokers.test.ts`; §24.5 updated |

**Explicitly later:** Phase A strict TS ladder, `CreateTaskModal` split (D), observability edge batch (I).

---

## Sprint 4 (completed)

**Theme:** Phase **E.3** compliance analytics + Phase **F** error boundaries outside `AppLayout`.

| # | Task | Status | Notes |
|---|------|--------|-------|
| S4.1 | Phase **E.3** — `compliance_item_completed` payload + mutation result | **Done** | `useMarkComplianceComplete`: fetch `document_type`, §24.5 `track` keys |
| S4.2 | Phase **F** (partial) — `ErrorBoundary` on login + contractor routes | **Done** | `App.tsx` wraps `/login`, `/contractor/access`, `/contractor/task/:id` |

---

## Sprint 5 (completed)

**Theme:** Rollout gap fill — **E.1** analytics index, **F.1** route/boundary map, onboarding **ErrorBoundary**s, **B.6** audit note.

| # | Task | Status | Notes |
|---|------|--------|-------|
| S5.1 | **E.1** — §24.5 implementation index + `issue_flagged` gap | **Done** | `@Docs/24_Phase1_Observability_Spec.md`; `document_uploaded` path corrected |
| S5.2 | **F.1** — High-traffic route ↔ boundary map | **Done** | Table below + checklist |
| S5.3 | **F** — Onboarding + auth callback routes wrapped | **Done** | `App.tsx` `RouteBoundary` on 11 paths |
| S5.4 | **B.6** — Admin cursor + audit clarity | **Done** | `@Docs/25_Admin_Cursor_Pagination_Design.md` Goals bullet |

---

## Sprint 6 (completed)

**Theme:** Phase **D.1** (`CreateTaskModal` inventory) + **F.2** retry invalidation + remaining **RouteBoundary** routes + **I.3** triage.

| # | Task | Status | Notes |
|---|------|--------|-------|
| S6.1 | Phase **D.1** — modal decomposition inventory | **Done** | [`26_CreateTaskModal_Inventory.md`](./26_CreateTaskModal_Inventory.md) |
| S6.2 | **F.2** — `onRetryReset` on `ErrorBoundary` | **Done** | `AppLayout` + **`AdminLayout`** call `queryClient.invalidateQueries()` on retry |
| S6.3 | **F** — `/design-library`, `/debug/data`, `*` 404 | **Done** | `App.tsx` `RouteBoundary` |
| S6.4 | **I.3** — grep debug telemetry hosts | **Done** | No `127.0.0.1` in `supabase/functions` |

### Route ↔ `ErrorBoundary` coverage (F.1)

| Area | Paths (representative) | Boundary |
|------|-------------------------|----------|
| Main app (Work / Manage / Record / settings / legacy) | `/*` under `ProtectedRoute` | **`AppLayout`** — `regionTitle="Main workspace"` |
| Hub / dashboard columns | `/` (dashboard) | **`app/page.tsx`** — per-column regions + **`onRetryReset`** → `invalidateQueries()` (Sprint 7) |
| Compliance overview | `/compliance` | **`Compliance.tsx`** |
| Record compliance workspace | `/record/compliance` | **`RecordCompliance.tsx`** |
| Admin | `/admin/*` | **`AdminLayout.tsx`** |
| Onboarding + auth (no `AppLayout`) | `/welcome`, `/signup`, `/verify`, `/accept-invitation`, `/auth/callback`, `/onboarding/*` | **`App.tsx`** — per-route `RouteBoundary` (Sprint 5) |
| Sign-in | `/login` | **`App.tsx`** — `ErrorBoundary` |
| Contractor | `/contractor/access`, `/contractor/task/:id` | **`App.tsx`** — `ErrorBoundary` |

**Not wrapped earlier (now wrapped in Sprint 6):** `/design-library`, `/debug/data`, catch-all **404** — each uses `RouteBoundary` in `App.tsx`.

---

## Sprint 7 (completed)

**Theme:** Phase **H.2** — deprecate legacy identity aliases; **F.2** — hub column **`ErrorBoundary`** retry invalidates React Query.

| # | Task | Status | Notes |
|---|------|--------|-------|
| S7.1 | **H.2** — `@deprecated` on `useCurrentOrg`, `useFillaIdentity` + **`02_Identity`** §8a | **Done** | No `src/` imports of those hooks; aliases retained for external/legacy |
| S7.2 | **F.2** — Dashboard `ErrorBoundary` `onRetryReset` | **Done** | `app/page.tsx` — Today & sidebar, Workbench, Details columns |

---

## Done (archive)

| Sprint | Item | Completed |
|--------|------|-----------|
| Pre | Phase 4 identity — `DataContext.orgId` ↔ `useActiveOrg`, provider order | merged `main` |
| Pre | Vitest scoped to `src`; `useVendor` build fix | merged `main` |
| Pre | `@Docs/Rollout_Checklist_1-2_Sprints.md` | merged `main` |
| Sprint 1 | Execution plan, README § Engineering, identity §8a, `AppLayout` `ErrorBoundary` | merged `main` |
| Sprint 2 | Property timeline + drift + field assignees (Insights) | merged `main` |
| Sprint 3 | Admin B.1/B.2–B.5, `document_uploaded` (E.2), analytics E.4–E.6 (`ai_task_generated`, resolution payloads, track allowlist test) | merged `main` |
| Sprint 4 | E.3 compliance `track` §24.5 alignment + ErrorBoundary on login / contractor routes | merged `main` |
| Sprint 5 | E.1 analytics index; F.1 route map; onboarding RouteBoundary; B.6 admin audit note | merged `main` |
| Sprint 6 | D.1 CreateTaskModal inventory; F.2 `onRetryReset`; design-library/debug/404 boundaries; I.3 triage | merged `main` |
| Sprint 7 | H.2 deprecated identity hooks; hub ErrorBoundary `onRetryReset` | merged `main` |

Update the **Done** table whenever a checklist phase ships.
