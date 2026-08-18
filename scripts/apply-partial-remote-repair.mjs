#!/usr/bin/env node
/**
 * Retired. Partial remote repair is not a normal workflow.
 * Local: supabase start && supabase db reset
 */
console.error(`
apply-partial-remote-repair is retired.

Those ensure_* files live in supabase/migrations/archive/pre_baseline_20260817/.
Local: supabase start && supabase db reset
Do not run this against gbtexoyvfpnduykmxunc.
`);
process.exit(1);
