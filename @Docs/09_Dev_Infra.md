# CHAPTER 9 — DEVELOPER INFRASTRUCTURE

**9.1 — STRUCTURE**
Standard `src/app`, `src/components`, `src/lib`.

**9.4 — BUILDER RULES**
1. Never invent tables. Schema contract: `@Docs/03_Data_Model.md`. Replayable DDL: `supabase/migrations/`.
2. Never disable RLS.
3. Use Identity/Org logic always. `useActiveOrg` is UX, not authorisation.

**9.5 — ENVIRONMENTS**

| Env | Supabase | How to build |
|---|---|---|
| Local | `supabase start` (Docker) | `supabase db reset` applies git baseline + seed |
| Staging | **New** project (not `gbtexoyvfpnduykmxunc`) | `supabase db push` onto an empty DB — [STAGING.md](../supabase/STAGING.md) |
| Production | `gbtexoyvfpnduykmxunc` | Same project as historical shared-dev. **Never Dashboard-reset.** Cutover stamp is gated (`npm run db:cutover-stamp`). |

`gbtexoyvfpnduykmxunc` is currently the only hosted environment. Treat every write as production.

**9.6 — LOCAL BACKEND**

Requires Docker Desktop or Colima.

```sh
supabase start
supabase db reset
npm run gen:types
cp .env.example .env.local   # then use local keys from `supabase status`
npm run dev                  # Vite http://localhost:8080
```

Auth emails go to Inbucket (`http://127.0.0.1:54324`). Social login is not copied from hosted Auth.

Types: `src/integrations/supabase/types.ts` from **local** schema. Do not `gen:types --linked` against production.

**9.7 — CI**

`.github/workflows/backend.yml`: `supabase start` → `db reset` → two-org RLS harness → JWT-off inventory → `npm test`. Never points at hosted.

**9.8 — MIGRATIONS**

Active history starts at `20260817120000_baseline.sql`. Pre-baseline files are in `supabase/migrations/archive/pre_baseline_20260817/`. Gaps vs constitution: `@Docs/Schema_Discrepancy_Register.md`.

**9.11 — CONTROL FILES**
Agents must read control docs (`builder-control.md`) before editing.
