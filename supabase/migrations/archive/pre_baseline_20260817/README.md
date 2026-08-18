# Pre-baseline migrations (archived 2026-08-17)

These 216 SQL files are **not** applied by `supabase db reset` or `db push`.

They document how the hosted project `gbtexoyvfpnduykmxunc` evolved. Filename order cannot rebuild a fresh database (views before columns, `ensure_*` patches, invalid timestamps, Dashboard SQL).

**Active migrations** live in `supabase/migrations/`:

1. `20260817120000_baseline.sql` — live public schema dump
2. `20260817120001_reconcile_canonical_gaps.sql` — objects required by `@Docs/03` that were missing on live
3. `20260817120002_storage_buckets_and_policies.sql` — buckets + `storage.objects` policies

Do not move these files back into `supabase/migrations/` unless you are diagnosing history.
