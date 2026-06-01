# FILLA — Property Task Pro

Property operations platform: tasks, compliance, assets, and team workflows. React + Supabase.

## Local setup

Requires [Node.js](https://nodejs.org/) (LTS) and npm.

```sh
git clone <YOUR_GIT_URL>
cd property-task-pro
npm ci
cp .env.example .env   # fill in Supabase values from your project dashboard
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

### Environment variables

| Variable | Where | Notes |
|----------|--------|--------|
| `VITE_SUPABASE_URL` | `.env`, Vercel | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env`, Vercel | Public (anon/publishable) |
| `VITE_SUPABASE_PROJECT_ID` | `.env` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` only (local scripts) | **Secret** — never commit or prefix with `VITE_` |
| `VITE_POSTHOG_KEY` | `.env`, Vercel | Public analytics key |
| `VITE_APP_URL` | Vercel production | Auth redirect base URL |

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
| `npm run gen:types` | Regenerate `src/types/supabase.ts` from linked project |

Package manager: **npm** (`package-lock.json`). Use `npm ci` in CI and fresh clones.

## Stack

- Vite, TypeScript, React
- shadcn-ui, Tailwind CSS (neomorphic design system — see `@Docs/04_UI_System.md`)
- Supabase (Postgres, Auth, Storage, Edge Functions)

### Supabase types

Frontend types come from the live public schema (`src/types/supabase.ts`). After DB migrations:

```sh
npm run db:push      # apply migrations (after supabase link)
npm run gen:types
```

Requires Supabase CLI and `supabase link`. If `db push` fails with **organisations already exists**, run `npm run db:diagnose` — usually you need a **database reset** in the Dashboard, then `npm run db:push` again.

Legacy pre-init SQL is archived under `supabase/migrations/archive/legacy_pre_v2_init/`.

## Engineering

- **Canonical docs:** [`@Docs/`](./@Docs/) — data model, identity, UI system (see `.cursorrules`)
- **Backend overview:** [`README_BACKEND.md`](./README_BACKEND.md), [`ARCHITECTURE_BACKEND.md`](./ARCHITECTURE_BACKEND.md)
- **Rollout backlog:** [`@Docs/Rollout_Checklist_1-2_Sprints.md`](./@Docs/Rollout_Checklist_1-2_Sprints.md)
- **Current execution:** [`@Docs/Rollout_Execution_Plan.md`](./@Docs/Rollout_Execution_Plan.md)
- **TypeScript strictness:** [`@Docs/28_TypeScript_Strictness_Debt.md`](./@Docs/28_TypeScript_Strictness_Debt.md)
- **Lint policy:** `npm run lint` targets `src/` only. `supabase/functions/**` is Deno — lint separately if needed. Some `@typescript-eslint` rules are warnings until cleanup; see `eslint.config.js`.

## Deploy (Vercel + Supabase)

### Vercel

1. Connect the repo and set build command `npm run build`, output `dist`.
2. **Environment variables** (Production / Preview as needed):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `VITE_APP_URL` — e.g. `https://your-app.vercel.app` (no trailing slash)
   - `VITE_POSTHOG_KEY` (optional)
3. Redeploy after env changes (Vite bakes `VITE_*` at build time).

### Supabase Auth URLs

Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** same as `VITE_APP_URL`
- **Redirect URLs:** include `/verify`, `/login`, `/accept-invitation` on that host

### Edge function secrets

Set `SUPABASE_SERVICE_ROLE_KEY` and other secrets in Supabase → Project Settings → Edge Functions. For invite emails, set `SITE_URL` to your production URL.

### Platform admin

Insert your auth user into `platform_admins` — see `supabase/migrations/20260511000001_create_platform_admins.sql` and [`@Docs/25_Phase2_Admin_Panel_Spec.md`](./@Docs/25_Phase2_Admin_Panel_Spec.md).
