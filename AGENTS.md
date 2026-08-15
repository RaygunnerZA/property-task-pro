# AGENTS.md

## Cursor Cloud specific instructions

FILLA ("Property Task Pro") is a **single client-side SPA** (Vite + React + TypeScript) that talks
directly to **Supabase** (Postgres, Auth, Storage, Edge Functions). There is no separate backend
server to run — the "backend" is a Supabase project.

Standard commands live in `README.md` and `package.json` scripts; don't duplicate them. Key ones:
`npm run dev`, `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`.

### Running the app (non-obvious caveats)

- **The dev server runs on port `8080` with `strictPort: true`** (`vite.config.ts`), not `5173`.
  The README's "typically http://localhost:5173" note is stale — use `http://localhost:8080`.
- **A Supabase backend is required to do anything past the landing page.** Create `.env` from
  `.env.example` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
  `VITE_SUPABASE_PROJECT_ID` from a **hosted Supabase project that already has the schema applied**.
  `.env` is gitignored. Vite also picks these up automatically if they are present as `VITE_`-prefixed
  environment variables (e.g. injected Cursor secrets), so a `.env` file is not strictly required.
- Without valid Supabase credentials the SPA still builds and renders the "Welcome to Filla" landing
  page, but shows a "Trying to restore connection" banner and all auth/data calls fail. This is
  expected, and is enough to confirm the frontend toolchain works — but it is **not** a functional
  end-to-end run.

### Do NOT try to bring up a local Supabase database from scratch

`supabase start` / `supabase db push` against a fresh database **fails on the repo's own migrations**.
The migration set is reconciled manually against the hosted project, not designed for clean
sequential application. Confirmed blockers when applying `supabase/migrations/` in order:

- `20251220000037_fix_duplicate_org_check.sql` has malformed PL/pgSQL (missing statement
  terminators), so it fails to parse.
- `20251228223327_create_optimized_views.sql` references columns (e.g. `properties.owner_name`)
  that are only added by later "ensure/repair" migrations, so it errors with
  `column ... does not exist`.

The repo works around this with manual Dashboard SQL (`supabase/run_pending_migrations_manual.sql`,
`apply_views_migration.sql`) and the `db:repair-*` / `db:mark-local-applied` scripts. Use a hosted
Supabase project instead of a local stack.

### Checks (current state on `main`)

- `npm test` — passes (Vitest, ~434 tests). Runs without any backend.
- `npm run build` — succeeds.
- `npm run lint` (the merge gate, `src/` only) and `npm run typecheck` currently report
  **pre-existing errors** on `main`. These are repo-side issues, not environment problems; don't
  treat them as something the environment setup broke.
