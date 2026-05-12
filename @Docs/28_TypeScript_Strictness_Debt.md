# TypeScript compiler strictness — current debt and deferral (Phase A)

**Purpose:** Record **conscious deferral** for checklist **Phase A** (A.1–A.2) and sign-off until the project can run `tsc -p tsconfig.app.json --noEmit` clean (or under an agreed error budget).

**Parent:** [`Rollout_Checklist_1-2_Sprints.md`](./Rollout_Checklist_1-2_Sprints.md) Phase **A**

---

## Facts (as of last triage on `main`)

- **`tsconfig.app.json`** keeps `"strict": false` and does not enable **`noUnusedLocals`** / **`noUnusedParameters`** yet.
- Running **`npx tsc -p tsconfig.app.json --noEmit`** surfaces on the order of **hundreds** of errors, including:
  - **`src/types/database.ts`** table name helpers vs generated **`Database`** shape mismatches
  - Other strictness-adjacent issues that are **not** introduced solely by unused flags
- **CI today** validates **`npm run build`** (Vite) and **`npm test`** (Vitest); it does **not** gate merge on full `tsc` (see checklist **0.2**).

**Risk acceptance:** Shipping continues to rely on build + tests + code review. Compiler strictness is **incremental follow-up**; do not flip **`strict`** or unused flags in one step without a dedicated burn-down sprint.

---

## Recommended order (when Phase A resumes)

1. Align **`src/types/database.ts`** (and any hand-written table generics) with **`src/types/supabase.ts`** / regenerated types so `tsc` error count drops materially.
2. Enable **`noUnusedLocals`** / **`noUnusedParameters`** in **`tsconfig.app.json`** and fix fallout (checklist **A.1**).
3. Enable **`noImplicitAny`** and burn down `any` in hooks and API boundaries (**A.2**).
4. **`strictNullChecks`** then **`"strict": true`** (**A.3–A.4**).

---

**Revision:** Update counts and bullets after each triage PR.
