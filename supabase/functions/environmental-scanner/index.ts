// environmental-scanner — manual / cron trigger
// Throttle: each property is skipped if scanned within SCAN_COOLDOWN_MS.
// Pass { force: true } to bypass cooldown (manual QA or catch-up run).
// Every invocation writes one row to signal_source_runs for observability.
// See @Docs/Signal_Governance.md for thresholds and cron guidance.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/geoUtils.ts";
import {
  detectWeatherSignals,
  emitSignal,
  fetchGoogleAirQuality,
  fetchGooglePollen,
  fetchOpenMeteoForecast,
  pickTopWeatherSignals,
  propertyDedupeKey,
  weatherExpiresAt,
} from "../_shared/signalEngine.ts";

// ── Thresholds (see Signal_Governance.md to change) ─────────────────────────
const MAX_ORGS_PER_RUN      = 10;
const MAX_PROPERTIES_PER_ORG = 25;
const SCAN_COOLDOWN_MS      = 12 * 60 * 60 * 1000; // 12 h
const MIN_AIR_QUALITY_AQI   = 100;
const MIN_POLLEN_UPI        = 4;
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);

  const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleKey     = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
  if (!serviceRoleKey) return jsonResponse({ error: "Service role not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body      = await req.json().catch(() => ({}));
  const forceScan = body.force === true;
  const runType   = body.run_type ?? (forceScan ? "manual" : "scheduled");
  let orgIds: string[] = body.org_id ? [body.org_id] : [];

  if (orgIds.length === 0) {
    const { data: orgs } = await admin
      .from("organisations")
      .select("id")
      .limit(MAX_ORGS_PER_RUN);
    orgIds = (orgs ?? []).map((o) => o.id);
  }

  // Start run log row (org_id null for multi-org runs)
  const singleOrg = orgIds.length === 1 ? orgIds[0] : null;
  const { data: runRow } = await admin
    .from("signal_source_runs")
    .insert({
      source_key: "environmental",
      org_id: singleOrg,
      run_type: runType,
      metadata: { force: forceScan, orgs_requested: orgIds.length },
    })
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  // Expire stale environmental signals before scanning
  const { data: expiredCount } = await admin.rpc("expire_stale_environmental_signals");

  // Counters
  let totalScanned   = 0;
  let totalSkipped   = 0;
  let totalSignals   = 0;
  let totalDuplicates = 0;
  let totalApiCalls  = 0;
  const errors: Array<{ property_id?: string; message: string }> = [];

  for (const orgId of orgIds) {
    const { data: properties } = await admin
      .from("properties")
      .select("id, nickname, address, latitude, longitude, last_environmental_scan_at")
      .eq("org_id", orgId)
      .eq("is_archived", false)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("last_environmental_scan_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PROPERTIES_PER_ORG);

    const now = Date.now();

    for (const prop of properties ?? []) {
      const lastScan = prop.last_environmental_scan_at
        ? new Date(prop.last_environmental_scan_at as string).getTime()
        : 0;

      if (!forceScan && lastScan > 0 && now - lastScan < SCAN_COOLDOWN_MS) {
        totalSkipped++;
        continue;
      }

      totalScanned++;
      const lat  = prop.latitude as number;
      const lng  = prop.longitude as number;
      const name = (prop.nickname || prop.address) as string;

      try {
        // Weather (Open-Meteo — no key required)
        const forecast     = await fetchOpenMeteoForecast(lat, lng);
        totalApiCalls++;
        const weatherSigs  = pickTopWeatherSignals(detectWeatherSignals(forecast), 2);

        for (const ws of weatherSigs) {
          const id = await emitSignal(admin, {
            org_id:     orgId,
            property_id: prop.id,
            subtype:    ws.subtype,
            title:      ws.title,
            body:       ws.body.replace("Property", name),
            category:   "environmental",
            kind:       ws.kind,
            severity:   ws.severity,
            source:     "open_meteo",
            source_key: "weather",
            disposition: ws.severity === "urgent" ? "urgent" : "recent",
            payload:    { forecast },
            dedupe_key: propertyDedupeKey(prop.id, ws.subtype, undefined, "open_meteo"),
            expires_at: weatherExpiresAt(ws.date),
          });
          id ? totalSignals++ : totalDuplicates++;
        }

        // Air quality + pollen (Google — optional)
        if (googleKey) {
          const aq = await fetchGoogleAirQuality(lat, lng, googleKey);
          totalApiCalls++;
          if (aq && aq.aqi >= MIN_AIR_QUALITY_AQI) {
            const id = await emitSignal(admin, {
              org_id:     orgId,
              property_id: prop.id,
              subtype:    "air_quality.poor",
              title:      "Poor air quality",
              body:       `Air quality index ${aq.aqi} (${aq.category}) at ${name}. Ventilation review recommended.`,
              category:   "environmental",
              kind:       "weather",
              severity:   "warning",
              source:     "google_air_quality",
              source_key: "air_quality",
              payload:    aq,
              dedupe_key: propertyDedupeKey(prop.id, "air_quality.poor", undefined, "google_air_quality"),
              expires_at: weatherExpiresAt(new Date().toISOString().slice(0, 10)),
            });
            id ? totalSignals++ : totalDuplicates++;
          }

          const pollen = await fetchGooglePollen(lat, lng, googleKey);
          totalApiCalls++;
          if (pollen && pollen.upi >= MIN_POLLEN_UPI) {
            const id = await emitSignal(admin, {
              org_id:     orgId,
              property_id: prop.id,
              subtype:    "pollen.high",
              title:      "High pollen levels",
              body:       `Pollen index ${pollen.upi} (${pollen.level}) at ${name}. Filter replacement recommended.`,
              category:   "environmental",
              kind:       "weather",
              severity:   "warning",
              source:     "google_pollen",
              source_key: "pollen",
              payload:    pollen,
              dedupe_key: propertyDedupeKey(prop.id, "pollen.high", undefined, "google_pollen"),
              expires_at: weatherExpiresAt(new Date().toISOString().slice(0, 10)),
            });
            id ? totalSignals++ : totalDuplicates++;
          }
        }

        await admin
          .from("properties")
          .update({ last_environmental_scan_at: new Date().toISOString() })
          .eq("id", prop.id);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ property_id: prop.id as string, message: msg });
      }
    }
  }

  // Finish run log row
  const runStatus = errors.length === 0
    ? "success"
    : totalScanned > 0 ? "partial" : "failed";

  if (runId) {
    await admin
      .from("signal_source_runs")
      .update({
        finished_at:        new Date().toISOString(),
        status:             runStatus,
        orgs_scanned:       orgIds.length,
        properties_scanned: totalScanned,
        skipped:            totalSkipped,
        api_calls:          totalApiCalls,
        signals_created:    totalSignals,
        duplicates_ignored: totalDuplicates,
        expired_cleared:    expiredCount ?? 0,
        errors:             errors,
      })
      .eq("id", runId);
  }

  const result = {
    ok:                 true,
    run_id:             runId,
    orgs:               orgIds.length,
    properties_scanned: totalScanned,
    skipped:            totalSkipped,
    api_calls:          totalApiCalls,
    signals_created:    totalSignals,
    duplicates_ignored: totalDuplicates,
    expired_cleared:    expiredCount ?? 0,
    errors,
  };

  console.log(JSON.stringify({ event: "environmental_scanner_run", ...result }));
  return jsonResponse(result);
});
