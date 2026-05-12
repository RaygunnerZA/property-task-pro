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

## Done (archive)

| Sprint | Item | Completed |
|--------|------|-----------|
| Pre | Phase 4 identity — `DataContext.orgId` ↔ `useActiveOrg`, provider order | merged `main` |
| Pre | Vitest scoped to `src`; `useVendor` build fix | merged `main` |
| Pre | `@Docs/Rollout_Checklist_1-2_Sprints.md` | merged `main` |
| Sprint 1 | Execution plan, README § Engineering, identity §8a, `AppLayout` `ErrorBoundary` | merged `main` |
| Sprint 2 | Property timeline + drift + field assignees (Insights) | merged `main` |
| Sprint 3 | Admin B.1/B.2–B.5, `document_uploaded` (E.2), analytics E.4–E.6 (`ai_task_generated`, resolution payloads, track allowlist test) | merged `main` |

Update the **Done** table whenever a checklist phase ships.
