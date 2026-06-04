// environmental-scanner — cron: weather (Open-Meteo) + air quality + pollen → signals
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/geoUtils.ts";
import {
  detectWeatherSignals,
  emitSignal,
  fetchGoogleAirQuality,
  fetchGooglePollen,
  fetchOpenMeteoForecast,
  propertyDedupeKey,
} from "../_shared/signalEngine.ts";

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
  let orgIds: string[] = body.org_id ? [body.org_id] : [];

  if (orgIds.length === 0) {
    const { data: orgs } = await admin.from("organisations").select("id").limit(500);
    orgIds = (orgs ?? []).map((o) => o.id);
  }

  const summary: Record<string, { properties: number; signals: number }> = {};

  for (const orgId of orgIds) {
    let signalCount = 0;
    const { data: properties } = await admin
      .from("properties")
      .select("id, nickname, address, latitude, longitude")
      .eq("org_id", orgId)
      .eq("is_archived", false);

    for (const prop of properties ?? []) {
      if (prop.latitude == null || prop.longitude == null) {
        await emitSignal(admin, {
          org_id: orgId,
          property_id: prop.id,
          subtype: "property.missing_location_data",
          title: "Property missing location data",
          body: `${prop.nickname || prop.address} needs a geocoded address for environmental monitoring.`,
          category: "property",
          kind: "system",
          severity: "info",
          source: "environmental_scanner",
          dedupe_key: propertyDedupeKey(prop.id, "property.missing_location_data"),
        });
        signalCount++;
        continue;
      }

      const lat = prop.latitude as number;
      const lng = prop.longitude as number;
      const name = prop.nickname || prop.address;

      // Weather
      const forecast = await fetchOpenMeteoForecast(lat, lng);
      const weatherSignals = detectWeatherSignals(forecast);
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
          dedupe_key: propertyDedupeKey(prop.id, ws.subtype),
        });
        if (id) signalCount++;
      }

      // Air quality
      if (googleKey) {
        const aq = await fetchGoogleAirQuality(lat, lng, googleKey);
        if (aq && aq.aqi >= 80) {
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
            dedupe_key: propertyDedupeKey(prop.id, "air_quality.poor"),
          });
          if (id) signalCount++;
        }

        const pollen = await fetchGooglePollen(lat, lng, googleKey);
        if (pollen && pollen.upi >= 3) {
          const id = await emitSignal(admin, {
            org_id: orgId,
            property_id: prop.id,
            subtype: "pollen.high",
            title: "High pollen levels",
            body: `Pollen index ${pollen.upi} (${pollen.level}) at ${name}. Filter replacement recommended.`,
            category: "environmental",
            kind: "weather",
            severity: "info",
            source: "google_pollen",
            payload: pollen,
            dedupe_key: propertyDedupeKey(prop.id, "pollen.high"),
          });
          if (id) signalCount++;
        }
      }
    }

    summary[orgId] = {
      properties: properties?.length ?? 0,
      signals: signalCount,
    };
  }

  return jsonResponse({ ok: true, summary });
});
