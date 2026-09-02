# CHAPTER 32 — Phase 3: Knowledge Depth & Hardening

**Status:** Backlog roadmap (not constitution)  
**Defers to:** `@Docs/03_Data_Model.md`, `@Docs/07_AI_Intelligence.md`, `@Docs/20_Billing.md`, `@Docs/29_Knowledge.md`, `@Docs/30_Phase2_Knowledge_First.md`, `@Docs/Schema_Discrepancy_Register.md`  
**On conflict, constitution wins.**

Phase 2 finishes the **admin Knowledge loop** (intake, guidance quality, critic gates, review workbench, org published library polish). Phase 3 holds **harder** incomplete work. Do not reopen these as drive-bys in unrelated PRs.

---

## 1. Knowledge depth

| Item | Notes |
|------|--------|
| Entity links | Wire `knowledge_links` / `link_knowledge_entity` into Properties, Spaces, Assets, Compliance, Tasks, Reports. Records only after data-model update. |
| Living Knowledge | Contextual, dismissible, cited guidance in workbench surfaces (Assets, Compliance, Tasks, Reports, context panels / Action Layer). No new nav. |
| Paste intake | Manual-equivalent paste and/or paste → `ai-doc-analyse` multi-candidate proposals. |
| Richer search | Beyond org ILIKE — FTS/embeddings if product requires. |
| Assistant citations | Published Knowledge only in assistant-reasoner answers. |
| Reuse / stale / superseded metrics | Product surfaces + instrumentation on existing `knowledge_usage_events` / admin & org metric RPCs. |
| Discovery → candidates | Quality, dedupe, Filla Brain cohort rules before creating Knowledge candidates. |
| Content Tree generation | AI/editorial generation beyond manual SEO/Brief/Outputs; Creative & Publishing remain stubs until this ships. |
| Org customer upload intake | Organisation-scoped upload path (not only platform admin bulk). |
| Distribution | In-app tips, website, newsletters using existing identity/applicability/notification rules — no separate distribution engine. |

---

## 2. Platform hardening

| Item | Notes |
|------|--------|
| Edge Function JWT | In-function auth for flagged `verify_jwt = false` user-callable functions (`intake-process`, `ai-extract`, `ai-doc-analyse`, `ai-image-analyse`, `knowledge-critic`, `knowledge-discovery`). See Schema Discrepancy Register. |
| Storage org isolation | e.g. `property-images` policies that only check `auth.uid()`. |
| `assigned_properties` empty semantics | Empty grant-all vs deny — resolve against Ch 3 / identity docs. |
| Staging vs shared prod=dev | Dedicated staging project; stop treating hosted project as sole shared environment. |
| Admin org list cursor | Re-ship `admin_list_orgs` keyset pagination when org volume justifies. |

---

## 3. Product & engineering debt

| Item | Notes |
|------|--------|
| CreateTaskModal D.2 remainder | Full `useCreateTaskModalState` / presentational split (`@Docs/26`). |
| TypeScript strictness ladder | `@Docs/28_TypeScript_Strictness_Debt.md` (A.1–A.5). |
| Business governance | Approval workflows, SSO/SCIM, regional hierarchy, hard-delete lifecycle (`@Docs/28_Billing_Implementation_Plan` Phase 6). |
| Packaging optimization | Contribution-margin driven package tuning (Phase 7). |
| Real compliance PDF | Only if productized — stub removed in easy-wins; do not recreate placeholders. |
| Invite space/asset restrictions | Only if productized — UI stubs removed in easy-wins. |
| i18n (EN/DE) | Ch 8 contract; no library yet. |
| `issue_flagged` analytics | Needs issue-creation product path first (`@Docs/24`). |

---

## Development rule

> Prefer completing one Phase 3 slice end-to-end over starting several. Knowledge depth items still outrank unrelated new platform pillars unless constitution or security requires otherwise.

Index: `@Docs/00_Index.txt`
