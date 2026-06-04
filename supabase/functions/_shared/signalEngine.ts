import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { todayDedupeSuffix } from "./geoUtils.ts";

export interface EmitSignalInput {
  org_id: string;
  subtype: string;
  title: string;
  body?: string;
  kind?: string;
  category?: string;
  severity?: string;
  property_id?: string;
  space_id?: string;
  asset_id?: string;
  /** Low-level API provider: open_meteo, google_air_quality, device_gps, … */
  source?: string;
  /** Governance bucket: weather, air_quality, pollen, gps_evidence, … */
  source_key?: string;
  payload?: Record<string, unknown>;
  recommendation?: Record<string, unknown>;
  dedupe_key?: string;
  expires_at?: string;
  disposition?: string;
  review_state?: string;
}

export async function emitSignal(
  admin: SupabaseClient,
  input: EmitSignalInput
): Promise<string | null> {
  const { data, error } = await admin.rpc("emit_signal", {
    p_org_id: input.org_id,
    p_subtype: input.subtype,
    p_title: input.title,
    p_body: input.body ?? null,
    p_kind: input.kind ?? "system",
    p_category: input.category ?? "operational",
    p_severity: input.severity ?? "info",
    p_property_id: input.property_id ?? null,
    p_space_id: input.space_id ?? null,
    p_asset_id: input.asset_id ?? null,
    p_source: input.source ?? "system",
    p_source_key: input.source_key ?? null,
    p_payload: input.payload ?? {},
    p_recommendation: input.recommendation ?? null,
    p_dedupe_key: input.dedupe_key ?? null,
    p_expires_at: input.expires_at ?? null,
    p_disposition: input.disposition ?? "recent",
    p_review_state: input.review_state ?? "none",
  });
  if (error) {
    console.error("emit_signal error:", error.message);
    return null;
  }
  return data as string;
}

export function propertyDedupeKey(
  propertyId: string,
  subtype: string,
  date = todayDedupeSuffix(),
  source?: string
): string {
  if (source) return `${propertyId}:${subtype}:${source}:${date}`;
  return `${propertyId}:${subtype}:${date}`;
}

const WEATHER_SEVERITY_RANK: Record<string, number> = {
  info: 0,
  warning: 1,
  urgent: 2,
  critical: 3,
};

/** Cap weather noise: keep the most important forecasts per scan. */
export function pickTopWeatherSignals<
  T extends { subtype: string; severity: string },
>(signals: T[], limit = 2): T[] {
  return [...signals]
    .sort(
      (a, b) =>
        (WEATHER_SEVERITY_RANK[b.severity] ?? 0) -
        (WEATHER_SEVERITY_RANK[a.severity] ?? 0)
    )
    .slice(0, limit);
}

export function weatherExpiresAt(forecastDate: string): string {
  return `${forecastDate}T23:59:59.999Z`;
}

export interface WeatherDay {
  date: string;
  precipitationMm: number;
  weatherCode: number;
  windMaxKmh: number;
  tempMinC: number;
  tempMaxC: number;
}

export async function fetchOpenMeteoForecast(
  lat: number,
  lng: number
): Promise<WeatherDay[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("daily", "precipitation_sum,weathercode,windspeed_10m_max,temperature_2m_min,temperature_2m_max");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = await res.json();
  const daily = json.daily;
  if (!daily?.time) return [];

  return daily.time.map((date: string, i: number) => ({
    date,
    precipitationMm: daily.precipitation_sum?.[i] ?? 0,
    weatherCode: daily.weathercode?.[i] ?? 0,
    windMaxKmh: daily.windspeed_10m_max?.[i] ?? 0,
    tempMinC: daily.temperature_2m_min?.[i] ?? 0,
    tempMaxC: daily.temperature_2m_max?.[i] ?? 0,
  }));
}

/** WMO weather code heuristics */
export function detectWeatherSignals(days: WeatherDay[]): Array<{
  subtype: string;
  title: string;
  body: string;
  severity: string;
  kind: string;
  date: string;
}> {
  const out: Array<{
    subtype: string;
    title: string;
    body: string;
    severity: string;
    kind: string;
    date: string;
  }> = [];
  for (const d of days) {
    if (d.precipitationMm >= 25) {
      out.push({
        subtype: "weather.heavy_rain",
        title: "Heavy rain forecast",
        body: `${d.precipitationMm.toFixed(0)}mm rain expected on ${d.date}. Drainage inspection recommended.`,
        severity: "warning",
        kind: "weather",
        date: d.date,
      });
    }
    if ([95, 96, 99].includes(d.weatherCode)) {
      out.push({
        subtype: "weather.storm",
        title: "Storm forecast",
        body: `Storm conditions expected on ${d.date}. Roof inspection recommended.`,
        severity: "urgent",
        kind: "weather",
        date: d.date,
      });
    }
    if (d.weatherCode === 96 || d.weatherCode === 99) {
      out.push({
        subtype: "weather.lightning",
        title: "Lightning risk",
        body: `Thunderstorm activity on ${d.date}. Check electrical infrastructure.`,
        severity: "urgent",
        kind: "weather",
        date: d.date,
      });
    }
    if (d.tempMinC <= 0) {
      out.push({
        subtype: "weather.freeze_risk",
        title: "Freeze risk",
        body: `Sub-zero temperatures (${d.tempMinC.toFixed(0)}°C) on ${d.date}. Pipe freeze prevention recommended.`,
        severity: "urgent",
        kind: "weather",
        date: d.date,
      });
    }
    if (d.tempMaxC >= 32) {
      out.push({
        subtype: "weather.heatwave",
        title: "Heatwave conditions",
        body: `High temperatures (${d.tempMaxC.toFixed(0)}°C) on ${d.date}. HVAC maintenance check recommended.`,
        severity: "warning",
        kind: "weather",
        date: d.date,
      });
    }
    if (d.windMaxKmh >= 60) {
      out.push({
        subtype: "weather.high_wind",
        title: "High wind warning",
        body: `Winds up to ${d.windMaxKmh.toFixed(0)} km/h on ${d.date}. External asset inspection recommended.`,
        severity: "warning",
        kind: "weather",
        date: d.date,
      });
    }
    if ([71, 73, 75, 77, 85, 86].includes(d.weatherCode)) {
      out.push({
        subtype: "weather.snow",
        title: "Snow forecast",
        body: `Snow expected on ${d.date}. Review access routes and gritting.`,
        severity: "warning",
        kind: "weather",
        date: d.date,
      });
    }
  }
  return out;
}

export async function fetchGoogleAirQuality(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ aqi: number; category: string } | null> {
  const res = await fetch(
    `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: { latitude: lat, longitude: lng } }),
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const idx = json.indexes?.find((i: { code?: string }) => i.code === "uaqi") ?? json.indexes?.[0];
  if (!idx) return null;
  return { aqi: idx.aqi ?? 0, category: idx.category ?? "Unknown" };
}

export async function fetchGooglePollen(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ upi: number; level: string } | null> {
  const res = await fetch(
    `https://pollen.googleapis.com/v1/forecast:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lng },
        days: 1,
      }),
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const daily = json.dailyInfo?.[0];
  const pollen = daily?.pollenTypeInfo?.find(
    (p: { type?: string }) => p.type === "GRASS" || p.type === "TREE"
  ) ?? daily?.pollenTypeInfo?.[0];
  if (!pollen) return null;
  const upi = pollen.indexInfo?.value ?? 0;
  const level = pollen.indexInfo?.category ?? "Low";
  return { upi, level };
}

export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number; placeId?: string; formatted?: string } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = await res.json();
  const result = json.results?.[0];
  if (!result?.geometry?.location) return null;
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    placeId: result.place_id,
    formatted: result.formatted_address,
  };
}
