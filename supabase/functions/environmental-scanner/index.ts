// environmental-scanner — manual/cron: weather (Open-Meteo) + air quality + pollen → signals
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

const MAX_ORGS_PER_RUN = 10;
const MAX_PROPERTIES_PER_ORG = 25;
const SCAN_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const MIN_AIR_QUALITY_AQI = 100;
const MIN_POLLEN_UPI = 4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
  if (!serviceRoleKey) {
    return jsonResponse({ error: "Service role not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const forceScan = body.force === true;
  let orgIds: string[] = body.org_id ? [body.org_id] : [];

  if (orgIds.length === 0) {
    const { data: orgs } = await admin.from("organisations").select("id").limit(MAX_ORGS_PER_RUN);
    orgIds = (orgs ?? []).map((o) => o.id);
  }

  const { data: expiredCount } = await admin.rpc("expire_stale_environmental_signals");
  const summary: Record<
    string,
    {
      scanned: number;
      skipped_cooldown: number;
      skipped_no_geo: number;
      signals: number;
    }
  > = {};
  const apiUsage = { open_meteo: 0, google_air_quality: 0, google_pollen: 0 };

  for (const orgId of orgIds) {
    let signalCount = 0;
    let scanned = 0;
    let skippedCooldown = 0;
    let skippedNoGeo = 0;

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
      if (prop.latitude == null || prop.longitude == null) {
        skippedNoGeo++;
        continue;
      }

      const lastScan = prop.last_environmental_scan_at
        ? new Date(prop.last_environmental_scan_at as string).getTime()
        : 0;
      if (!forceScan && lastScan > 0 && now - lastScan < SCAN_COOLDOWN_MS) {
        skippedCooldown++;
        continue;
      }

      scanned++;
      const lat = prop.latitude as number;
      const lng = prop.longitude as number;
      const name = prop.nickname || prop.address;

      const forecast = await fetchOpenMeteoForecast(lat, lng);
      apiUsage.open_meteo++;
      const weatherSignals = pickTopWeatherSignals(detectWeatherSignals(forecast), 2);
      for (const ws of weatherSignals) {
        const id = await emitSignal(admin, {
          org_id: orgId,
          property_id: prop.id,
          subtype: ws.subtype,
          title: ws.title,
          body: ws.body.replace("Property", name),
          category: "environmental",
          kind: ws.kind,
          severity: ws.severity,
          source: "open_meteo",
          disposition: ws.severity === "urgent" ? "urgent" : "recent",
          payload: { forecast },
          dedupe_key: propertyDedupeKey(prop.id, ws.subtype, undefined, "open_meteo"),
          expires_at: weatherExpiresAt(ws.date),
        });
        if (id) signalCount++;
      }

      if (googleKey) {
        const aq = await fetchGoogleAirQuality(lat, lng, googleKey);
        apiUsage.google_air_quality++;
        if (aq && aq.aqi >= MIN_AIR_QUALITY_AQI) {
          const id = await emitSignal(admin, {
            org_id: orgId,
            property_id: prop.id,
            subtype: "air_quality.poor",
            title: "Poor air quality",
            body: `Air quality index ${aq.aqi} (${aq.category}) at ${name}. Ventilation review recommended.`,
            category: "environmental",
            kind: "weather",
            severity: "warning",
            source: "google_air_quality",
            payload: aq,
            dedupe_key: propertyDedupeKey(prop.id, "air_quality.poor", undefined, "google_air_quality"),
            expires_at: weatherExpiresAt(new Date().toISOString().slice(0, 10)),
          });
          if (id) signalCount++;
        }

        const pollen = await fetchGooglePollen(lat, lng, googleKey);
        apiUsage.google_pollen++;
        if (pollen && pollen.upi >= MIN_POLLEN_UPI) {
          const id = await emitSignal(admin, {
            org_id: orgId,
            property_id: prop.id,
            subtype: "pollen.high",
            title: "High pollen levels",
            body: `Pollen index ${pollen.upi} (${pollen.level}) at ${name}. Filter replacement recommended.`,
            category: "environmental",
            kind: "weather",
            severity: "warning",
            source: "google_pollen",
            payload: pollen,
            dedupe_key: propertyDedupeKey(prop.id, "pollen.high", undefined, "google_pollen"),
            expires_at: weatherExpiresAt(new Date().toISOString().slice(0, 10)),
          });
          if (id) signalCount++;
        }
      }

      await admin
        .from("properties")
        .update({ last_environmental_scan_at: new Date().toISOString() })
        .eq("id", prop.id);
    }

    summary[orgId] = {
      scanned,
      skipped_cooldown: skippedCooldown,
      skipped_no_geo: skippedNoGeo,
      signals: signalCount,
    };
  }

  console.log(
    JSON.stringify({
      event: "environmental_scanner_run",
      orgs: orgIds.length,
      api_usage: apiUsage,
      expired_signals: expiredCount ?? 0,
      summary,
    })
  );

  return jsonResponse({
    ok: true,
    expired_signals: expiredCount ?? 0,
    api_usage: apiUsage,
    summary,
  });
});
