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
| S1.3 | `AppLayout` — regional `ErrorBoundary` around all main `children` (Work / Manage / Tasks / Settings, etc.) | **Done** | `AppLayout.tsx` |
| S1.4 | Link this plan from checklist (see checklist header) | **Done** | Header link in `Rollout_Checklist_1-2_Sprints.md` |

**Explicitly not in Sprint 1:** strict TS ladder (Phase A), admin RPC pagination (Phase B), property hub real hooks (Phase C), `CreateTaskModal` split (Phase D), analytics grep cleanup beyond audit (Phase E), observability edge batch (Phase I).

---

## Next sprint (Sprint 2 — suggested order)

1. **Phase B.1–B.2** — Admin pagination design + RPC/migrations (requires types regen).
2. **Phase E.2–E.3** — `document_uploaded` / any remaining UI `track` → mutation `onSuccess` (compliance complete already uses mutation `onSuccess`).
3. **Phase C.1–C.3** — Property timeline product decision + first real hook (highest user-visible value).

Re-sequence if product prioritises compliance analytics or property hub over admin scale.

---

## Done (archive)

| Sprint | Item | Completed |
|--------|------|-----------|
| Pre | Phase 4 identity — `DataContext.orgId` ↔ `useActiveOrg`, provider order | merged `main` |
| Pre | Vitest scoped to `src`; `useVendor` build fix | merged `main` |
| Pre | `@Docs/Rollout_Checklist_1-2_Sprints.md` | merged `main` |
| Sprint 1 | Execution plan, README § Engineering, identity §8a, `AppLayout` `ErrorBoundary` | merged `main` |

Update the **Done** table whenever a checklist phase ships.
