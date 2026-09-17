# Filla demo: Linden

Import-ready authored fixtures for local Supabase or a dedicated staging project.

- As-of: `2026-09-14T00:00:00+01:00`
- Time zone: `Europe/London`
- Organisations: `demo-linden-home`, `demo-linden-portfolio`
- Files: opaque WebP images only; no PDFs
- Signals: none; the fixture does not depend on the unresolved `signals` schema
- External effects: no notification channels, Stripe identifiers, invitations or AI processing

## Login matrix

| User | Organisation | Role | Property access |
|---|---|---|---|
| Maya Chen | 18 Linden Road | Owner, primary | All (Linden only) |
| Oliver Grant | Linden Residential Portfolio | Owner, primary | All six properties |
| Priya Shah | Linden Residential Portfolio | Manager | All six properties |
| Daniel Brooks | Linden Residential Portfolio | Staff | 18 Linden Road and 7 Rowan Close only |

Passwords in `dataset.json` are environment-variable references, not reusable secrets. The seed runner should resolve values beginning with `env:` and fail clearly when a required variable is absent.

## Expected recommendation stories

- Home/Linden: `waiting_access`; `certificate_expiry`; optionally `repeated_fault` when `task_assets` exists.
- Portfolio/Linden: `duplicate_report` from two open kitchen boiler leak tasks.
- Portfolio/Rowan: `tenant_notification` from a contractor visit due within seven days with no notification evidence.
- Portfolio/Harbour: `missing_certificate` from a recently completed fire-risk inspection with no certificate attachment or compliance document.
- Portfolio/Castle: `certificate_expiry` from an EICR due in 45 days.
- Portfolio/Tyne: visit contains a recorded outbound tenant notification and should suppress `tenant_notification`.
- Portfolio/Orchard: ordinary maintenance content with no intended recommendation.

Do not import into production. Seed Auth users first, then organisations, memberships, settings, subscriptions, properties and the remaining graph in the order defined by the import contract. Clear onboarding samples immediately after every property insert.

## Seed

Local or a dedicated staging project only. The runner refuses production `gbtexoyvfpnduykmxunc` and any hosted URL unless you pass `--allow-staging`.

If `.env.local` points at production, override the URL and service role for the local stack:

```sh
# Local Supabase (127.0.0.1:54321). Set DEMO_PASSWORD in the shell or a local-only env file.
DEMO_PASSWORD="choose-a-local-only-password" \
SUPABASE_URL="http://127.0.0.1:54321" \
VITE_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="<local-service-role>" \
npm run seed:demo-linden
```

Dedicated non-production hosted project:

```sh
npm run seed:demo-linden:staging
```

`--reset` replaces only organisations whose slugs start with `demo-linden-` plus `@filla-demo.test` Auth users. Postgres must be reachable (`SUPABASE_DB_URL` or local `127.0.0.1:54322`) so organisation inserts can skip `handle_new_organisation`. The seeder does not call AI, Stripe, or notification APIs.
