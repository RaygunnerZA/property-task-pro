# Staging Supabase project

`gbtexoyvfpnduykmxunc` is **production**. Developers and CI must not use it as a playground.

## Create

1. [Supabase Dashboard](https://supabase.com/dashboard) → New project (EU if prod is `eu-central-1`).
2. Do **not** link this repo’s `config.toml` `project_id` to production. For staging:

   ```sh
   supabase link --project-ref <STAGING_REF>
   ```

   Keep production linked only on a dedicated machine/profile, or use `--project-ref` explicitly.

3. Apply schema (empty database):

   ```sh
   supabase db push
   ```

   If the CLI asks to repair history, stop. Staging should be empty so push applies `20260817120000` onward only.

4. Deploy functions: `supabase functions deploy` (or CI). Set secrets (`STRIPE_*`, `SUPABASE_SERVICE_ROLE_KEY` is automatic, Google, Resend, etc.).

5. Auth → URL Configuration:

   - Staging Site URL: the staging app origin (Vercel preview or `https://staging.app.example`).
   - Redirect URLs: that origin’s `/login`, `/signup`, `/verify`, `/auth/callback`, `/reset-password`, `/accept-invitation`.
   - Do **not** point staging Auth at `https://app.filla.app` if it would mix sessions with production.

6. Smoke:

   - Sign up user A, create org + property + task, upload evidence.
   - Sign up user B in a **second** org.
   - Confirm B cannot SELECT A’s properties/tasks (table API and Storage paths).
   - Confirm public bucket URLs are treated as public (see discrepancy register).

## App env

Copy `.env.example` to `.env.staging.local` (untracked):

```
VITE_SUPABASE_URL=https://<STAGING_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon>
VITE_SUPABASE_PROJECT_ID=<STAGING_REF>
SUPABASE_SERVICE_ROLE_KEY=<secret, scripts only>
```

## After staging is green

Production cutover is **not** a Dashboard reset. See `scripts/cutover-stamp-baseline.mjs` and `@Docs/09_Dev_Infra.md`.
