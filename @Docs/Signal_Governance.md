# Signal Governance

Authority document for how Filla generates, throttles, deduplicates and surfaces signals.
Companion to `@Docs/19_Platform_Arch.md` (signals layer) and `@Docs/03_Data_Model.md`.

---

## Signal sources

| source_key        | provider(s)              | trigger  | throttle       | issues-eligible |
|-------------------|--------------------------|----------|----------------|-----------------|
| `weather`         | Open-Meteo (free)        | cron     | 12h/property   | warning+ only   |
| `air_quality`     | Google Air Quality API   | cron     | 12h/property   | warning+ only   |
| `pollen`          | Google Pollen API        | cron     | 12h/property   | no              |
| `address_validation` | Google Address Validation | event | once per save | warning+ only  |
| `property_geo_enrich` | Google Geocoding    | event    | once per save  | no              |
| `gps_evidence`    | Device GPS               | event    | per action     | off-site only   |
| `compliance_auto` | Internal compliance engine | event  | once per doc   | yes             |

`source_key` is stored on `signals.source_key`.
`source` (provider string) is also stored for API-level debugging.

---

## Thresholds (constants in edge function code)

Changes require a redeploy of `environmental-scanner`. Do not move to DB config unless
there is an actual product reason to vary per-property.

### Weather (`supabase/functions/environmental-scanner/index.ts`)

| Condition     | Subtype               | Threshold           | Severity |
|---------------|-----------------------|---------------------|----------|
| Heavy rain    | `weather.heavy_rain`  | precipitation ≥ 25mm | warning |
| Storm         | `weather.storm`       | WMO code 95/96/99   | urgent   |
| Lightning     | `weather.lightning`   | WMO code 96/99      | urgent   |
| Freeze        | `weather.freeze_risk` | min_temp ≤ 0°C      | urgent   |
| Heatwave      | `weather.heatwave`    | max_temp ≥ 32°C     | warning  |
| High wind     | `weather.high_wind`   | wind ≥ 60 km/h      | warning  |
| Snow          | `weather.snow`        | WMO 71/73/75/77/85/86 | warning |

At most **2 weather signals per property per run** (highest severity wins).

### Air quality

| Condition   | Subtype          | Threshold | Severity |
|-------------|------------------|-----------|----------|
| Poor AQ     | `air_quality.poor` | AQI ≥ 100 | warning |

### Pollen

| Condition   | Subtype       | Threshold | Severity | Issues |
|-------------|---------------|-----------|----------|--------|
| High pollen | `pollen.high` | UPI ≥ 4   | warning  | no     |

---

## Dedupe rules

`dedupe_key` format: `{property_id}:{subtype}:{provider}:{YYYY-MM-DD}`

Enforced by unique partial index on `signals`:
```sql
UNIQUE (org_id, dedupe_key)
WHERE dedupe_key IS NOT NULL
  AND resolved_at IS NULL
  AND disposition NOT IN ('dismissed')
```

`emit_signal()` is idempotent: if dedupe_key exists and is unresolved, returns existing ID.
Duplicate attempts are counted in `signal_source_runs.duplicates_ignored`.

---

## Expiry

Environmental signals have `expires_at` set to the end of the forecast day (`23:59:59Z`).
`expire_stale_environmental_signals()` RPC auto-dismisses past-window rows.
Called at the start of each scanner run.

---

## Issues eligibility

Controlled by `src/lib/signals/signalFeedEligibility.ts`.

Rules (in priority order):
1. Suppressed subtypes never appear: `property.geocoded`, `property.missing_location_data`, `location.gps_verified`
2. Expired signals (`expires_at < now()`) are hidden
3. Disposition `urgent` or `needs_review` → always show
4. Severity `warning`, `urgent`, `critical` → show
5. `recommendation.action === 'create_task'` + severity ≠ `info` → show
6. Everything else → hidden from Issues

`pollen.high` is severity `warning`, so it passes rule 4. If you want pollen
completely out of Issues, add `pollen.high` to `ISSUES_SUPPRESSED_SUBTYPES`.

---

## GPS evidence

GPS capture is **event-based only**. It is never polled or watched.

Call sites:
- `TaskDetailPanel` → `captureGeoForAction("task_complete")`
- `use-file-upload` → `captureGeoForAction("photo_upload")`
- `useMarkComplianceComplete` → `captureGeoForAction("compliance_record")`

`scanNearby` (nearby overdue task nudge) defaults **off**. It must be explicitly
passed as `true` to trigger the secondary `operational.nearby_overdue` signal.

User-facing copy: *"Filla can attach your location to this record as evidence."*

Off-site completion (`location.off_site_completion`) is the only GPS-derived signal
that surfaces in Issues. GPS verification (`location.gps_verified`) is stored in
`geo_captures` only and does not emit a signal.

---

## Run log (`signal_source_runs`)

Every `environmental-scanner` invocation writes one row.

Key fields:
- `status`: `running` → `success` / `partial` / `failed`
- `signals_created`: new unique signals inserted
- `duplicates_ignored`: dedupe hits (idempotent skips)
- `expired_cleared`: rows auto-dismissed at run start
- `errors`: JSON array of per-property errors

Query recent runs:
```sql
select source_key, run_type, status, started_at,
       properties_scanned, signals_created, duplicates_ignored, errors
from signal_source_runs
order by started_at desc
limit 10;
```

Visible in DevTools → Signal Diagnostics panel (dev builds only).

---

## Cron recommendation

Run `environmental-scanner` every **6 hours** via Supabase cron or external scheduler.
Internal throttle (`SCAN_COOLDOWN_MS = 12h`) means each property is only actually
scanned twice per day regardless of cron frequency.

```sql
-- Example pg_cron (Supabase dashboard → SQL editor)
select cron.schedule(
  'environmental-scanner-6h',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/environmental-scanner',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);
```

Do not pass `force: true` in cron. Force is for manual QA only.

---

## Manual testing commands

```bash
# 1. Run migration
npm run db:push

# 2. Deploy scanner
supabase functions deploy environmental-scanner

# 3. Force run for one org (from browser console, logged in)
await supabase.functions.invoke('environmental-scanner', {
  body: { org_id: '<your-org-id>', force: true }
})

# 4. Check run log
select * from signal_source_runs order by started_at desc limit 5;

# 5. Check signals
select subtype, source_key, severity, disposition, expires_at, dedupe_key
from signals
where resolved_at is null
order by created_at desc
limit 20;

# 6. Verify throttling (run again without force — should show skipped > 0)
await supabase.functions.invoke('environmental-scanner', {
  body: { org_id: '<your-org-id>' }
})
```

Expected response (force run):
```json
{
  "ok": true,
  "run_id": "<uuid>",
  "orgs": 1,
  "properties_scanned": 3,
  "skipped": 0,
  "api_calls": 3,
  "signals_created": 2,
  "duplicates_ignored": 1,
  "expired_cleared": 0,
  "errors": []
}
```

Expected response (throttled re-run):
```json
{
  "ok": true,
  "run_id": "<uuid>",
  "orgs": 1,
  "properties_scanned": 0,
  "skipped": 3,
  "api_calls": 0,
  "signals_created": 0,
  "duplicates_ignored": 0,
  "expired_cleared": 0,
  "errors": []
}
```

---

## Future extensions (when there is product need)

- `signal_sources` table: per-source on/off toggles for org admins
- `property_signal_settings`: per-property frequency overrides
- `should_run_property_signal` RPC: replaces `last_environmental_scan_at` check
- Promote thresholds to DB config rows when users can tune them

Implement these only when there is a real UI that mutates them.
Until then, constants in code + this doc = the source of truth.
