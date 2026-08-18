# FILLA — Property Task Pro

Property operations platform: tasks, compliance, assets, and team workflows. React + Supabase.

## Local setup

Requires [Node.js](https://nodejs.org/) (LTS), npm, [Docker](https://docs.docker.com/desktop/) (or Colima), and the [Supabase CLI](https://supabase.com/docs/guides/cli).

**Do not Dashboard-reset** hosted project `gbtexoyvfpnduykmxunc` — it is production.

```sh
git clone <YOUR_GIT_URL>
cd property-task-pro
npm ci
supabase start
supabase db reset
npm run gen:types
# copy API_URL / ANON_KEY / SERVICE_ROLE_KEY from `supabase status` into .env.local
cp .env.example .env.local
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:8080`). Auth mail: Inbucket at `http://127.0.0.1:54324`.

To hit a **hosted** project instead, put that project’s keys in `.env.local`. Never use production as a shared playground; staging is a separate project (`supabase/STAGING.md`).

Public marketing site (separate origin, no Supabase):

```sh
npm run dev:marketing
```

Opens on `http://localhost:4321`. Sign-in links target the app on port 8080.

### Environment variables

| Variable | Where | Notes |
|----------|--------|--------|
| `VITE_SUPABASE_URL` | `.env`, Vercel | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env`, Vercel | Public (anon/publishable) |
| `VITE_SUPABASE_PROJECT_ID` | `.env` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` only (local scripts) | **Secret** — never commit or prefix with `VITE_` |
| `VITE_POSTHOG_KEY` | `.env`, Vercel | Public analytics key |
| `VITE_APP_URL` | Vercel production | Auth redirect base URL |

Password reset emails use `{VITE_APP_URL}/reset-password`. Add that exact URL under Supabase → Authentication → URL Configuration → **Redirect URLs**, or recovery links fall back to Site URL (often login/home).

If `.env` was ever committed, rotate the **service role key** in Supabase Dashboard → Settings → API before continuing.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest (`src/`) |
| `npm run lint` | ESLint on `src/` (merge gate) |
| `npm run lint:all` | ESLint on repo TS (excludes `supabase/functions`) |
| `npm run typecheck` | `tsc --noEmit` (app config) |
| `npm run gen:types` | Regenerate `src/integrations/supabase/types.ts` from **local** Supabase |
| `npm run test:rls` | Two-org RLS harness (local/staging only; refuses production) |
| `npm run test:jwt-inventory` | Fail if a new Edge Function disables JWT without an allowlist update |
| `npm run db:reset` | `supabase db reset` |
| `npm run db:cutover-stamp` | Gated production history stamp — not daily use |

Package manager: **npm** (`package-lock.json`). Use `npm ci` in CI and fresh clones.

## Stack

- Vite, TypeScript, React
- shadcn-ui, Tailwind CSS (neomorphic design system — see `@Docs/04_UI_System.md`)
- Supabase (Postgres, Auth, Storage, Edge Functions)

### Supabase schema and types

Git is the rebuildable backend: `supabase start` → `supabase db reset` → `npm run gen:types`.

Active migrations are the 2026-08-17 baseline plus canonical-gap and storage files. Older SQL is under `supabase/migrations/archive/`. Inventory: [`@Docs/Schema_Discrepancy_Register.md`](./@Docs/Schema_Discrepancy_Register.md). Infra: [`@Docs/09_Dev_Infra.md`](@Docs/09_Dev_Infra.md).

Frontend types: `src/integrations/supabase/types.ts` (local dump). Do not generate types from the production project.

**Freeze:** no Dashboard DDL; no `db:mark-local-applied` as normal workflow.

## Engineering

- **Canonical docs:** [`@Docs/`](./@Docs/) — data model, identity, UI system (see `.cursorrules`)
- **Backend overview:** [`README_BACKEND.md`](./README_BACKEND.md), [`ARCHITECTURE_BACKEND.md`](./ARCHITECTURE_BACKEND.md)
- **Rollout backlog:** [`@Docs/Rollout_Checklist_1-2_Sprints.md`](./@Docs/Rollout_Checklist_1-2_Sprints.md)
- **Current execution:** [`@Docs/Rollout_Execution_Plan.md`](./@Docs/Rollout_Execution_Plan.md)
- **TypeScript strictness:** [`@Docs/28_TypeScript_Strictness_Debt.md`](./@Docs/28_TypeScript_Strictness_Debt.md)
- **Lint policy:** `npm run lint` targets `src/` only. `supabase/functions/**` is Deno — lint separately if needed. Some `@typescript-eslint` rules are warnings until cleanup; see `eslint.config.js`.

## Deploy (Vercel + Supabase)

Public site and product are **separate origins**. See [`@Docs/31_Public_Site.md`](./@Docs/31_Public_Site.md).

| Origin | Vercel project | Directory |
|---|---|---|
| `www.filla.app` | Marketing | `marketing/` (`npm run build`, output `dist`) |
| `app.filla.app` | Product | repo root (`npm run build`, output `dist`) |

### Product project

1. Connect the repo at the repository root. Build `npm run build`, output `dist`.
2. Domain: `app.filla.app`.
3. **Environment variables** (Production / Preview as needed):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `VITE_APP_URL=https://app.filla.app` (no trailing slash)
   - `VITE_MARKETING_URL=https://www.filla.app`
   - `VITE_POSTHOG_KEY` (optional)
4. Redeploy after env changes (Vite bakes `VITE_*` at build time).

### Marketing project

See [`marketing/README.md`](./marketing/README.md). Root directory `marketing`. Env: `VITE_APP_ORIGIN=https://app.filla.app`. No Supabase keys.

### Supabase Auth URLs

Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `https://app.filla.app` (same as `VITE_APP_URL`)
- **Redirect URLs:** app-origin paths only — `/verify`, `/login`, `/signup`, `/auth/callback`, `/reset-password`, `/accept-invitation`
- Do **not** allowlist `www.filla.app`

### Edge function secrets

Set `SUPABASE_SERVICE_ROLE_KEY` and other secrets in Supabase → Project Settings → Edge Functions. For invite emails, set `SITE_URL` to your production URL.

### Platform admin

Insert your auth user into `platform_admins` — see `supabase/migrations/README.md` and [`@Docs/25_Phase2_Admin_Panel_Spec.md`](./@Docs/25_Phase2_Admin_Panel_Spec.md). Do not put a personal UUID in `supabase/seed.sql`.
