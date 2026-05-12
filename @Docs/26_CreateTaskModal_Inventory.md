# CreateTaskModal — decomposition inventory (Phase D.1)

**Status:** Inventory only — no behaviour change.  
**Parent backlog:** [`Rollout_Checklist_1-2_Sprints.md`](./Rollout_Checklist_1-2_Sprints.md) Phase **D**  
**Monolith:** `src/components/tasks/CreateTaskModal.tsx` (~2.3k lines)

---

## 1. Role in the app

- Primary **task creation** UI (modal + column / headless variants).
- Uses **`useCreateTaskMutation`** for the actual insert (`mutateAsync`); `task_created` analytics stay in the mutation (`source`: `manual` | `ai` | `assistant` via props / prefill).
- Integrates **AI extract** (`useAIExtract`), **chip suggestions** (`useChipSuggestions`, `resolveChip`, `logChipResolution`), **images** (`useImageAnalysis`, uploads), **checklist templates**, org members / spaces / teams / categories.

---

## 2. Already-extracted UI (`src/components/tasks/create/*`)

| Area | Files / entry points |
|------|----------------------|
| Tabs (legacy / mobile) | `create/tabs/WhenTab`, `WhereTab`, `PriorityTab`; types from `WhoTab` |
| Panels | `create/panels/WhoPanel` |
| Sections | `WhoSection`, `WhenSection`, `WhereSection`, `AssetSection`, `CategorySection`, `ThemesSection`, `AssetsSection`, `SubtasksSection`, `ImageUploadSection`, `CreateTaskRow` |
| Shared UI | `ClarityState`, `ClaritySeverity`, `InstructionBlock` (if used), `ExpandableSection`, etc. |

**Implication for D.2–D.3:** most *presentational* pieces exist; the remaining debt is **orchestration + state** living in the modal root (dozens of `useState` / `useEffect` / submit pipeline).

---

## 3. Major regions still in the monolith (D.2 targets)

1. **Shell** — `Dialog` / `Drawer` / `headless` / `variant` layout; header; close / discard flows.
2. **Composer state** — title, description, priority, due date, milestones, property / space / asset / category selections.
3. **AI lane** — `useAIExtract`, prefill application, chip UI + resolution (`logChipResolution`).
4. **Submit pipeline** — `handleSubmit` (validation → `createTaskMutation.mutateAsync` → attachments / junction tables / invitations); must remain a **single** `mutateAsync` path for D.3.
5. **Secondary modals** — checklist template save/edit, invite user, confirm dialogs (`AlertDialog`).
6. **Mobile vs desktop** — tab switching, `collapseDetails`, `useIsMobile` branches.

---

## 4. Suggested extraction order (no behaviour change per step)

| Step | Extract | Risk |
|------|---------|------|
| D.2a | `useCreateTaskModalState` — all `useState` / `useReducer` + derived memos; modal receives state + setters or dispatch | Medium — needs exhaustive prop drilling or context |
| D.2b | `useCreateTaskModalSubmit` — `handleSubmit` + upload follow-ups; depends on state hook | High — test property + attachments + invite |
| D.3 | Move shell JSX into `CreateTaskModalShell.tsx`; keep mutation import only in one parent | Medium |

---

## 5. Verify after D.2 / D.3

- `task_created` fires **once** per successful create with correct **`source`**.
- No new **`track()`** callsites outside the Vitest allowlist in `src/lib/__tests__/analyticsTrackInvokers.test.ts`.
- Vitest + manual: create task with/without images, with prefill (AI), pending invite assignee.

---

**Revision:** Update this doc when D.2 lands (hook / file names).
