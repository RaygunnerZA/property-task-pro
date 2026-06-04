// signal-engine — emit, resolve, snooze, convert, assess geo captures
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, haversineMeters, jsonResponse } from "../_shared/geoUtils.ts";
import { emitSignal, propertyDedupeKey } from "../_shared/signalEngine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // User-scoped actions use caller JWT
  if (["resolve", "snooze", "convert"].includes(action)) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    if (action === "resolve") {
      const { data, error } = await userClient.rpc("resolve_signal", {
        p_signal_id: body.signal_id,
        p_disposition: body.disposition ?? "dismissed",
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: data });
    }
    if (action === "snooze") {
      const until = body.until ?? new Date(Date.now() + 86400000).toISOString();
      const { data, error } = await userClient.rpc("snooze_signal", {
        p_signal_id: body.signal_id,
        p_until: until,
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: data });
    }
    if (action === "convert") {
      const { data, error } = await userClient.rpc("convert_signal_to_task", {
        p_signal_id: body.signal_id,
        p_task_title: body.task_title ?? null,
        p_task_description: body.task_description ?? null,
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ task_id: data });
    }
  }

  if (!serviceRoleKey) {
    return jsonResponse({ error: "Service role not configured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "emit") {
    const id = await emitSignal(admin, body);
    return jsonResponse({ signal_id: id });
  }

  if (action === "assess_geo_capture") {
    const captureId = body.geo_capture_id as string;
    const { data: capture, error: capErr } = await admin
      .from("geo_captures")
      .select("*, properties:property_id(latitude, longitude, nickname, address)")
      .eq("id", captureId)
      .maybeSingle();
    if (capErr || !capture) {
      return jsonResponse({ error: "Capture not found" }, 404);
    }

    const prop = capture.properties as {
      latitude?: number;
      longitude?: number;
      nickname?: string;
      address?: string;
    } | null;

    const propertyName = prop?.nickname || prop?.address || "Property";
    const orgId = capture.org_id as string;
    const propertyId = capture.property_id as string | null;

    if (prop?.latitude != null && prop?.longitude != null) {
      const dist = haversineMeters(
        capture.latitude,
        capture.longitude,
        prop.latitude,
        prop.longitude
      );
      const verified = dist <= (body.geofence_m ?? 200);
      if (verified) {
        await emitSignal(admin, {
          org_id: orgId,
          property_id: propertyId ?? undefined,
          subtype: "location.gps_verified",
          title: "GPS verified on-site",
          body: `Work at ${propertyName} completed with verified on-site location (${Math.round(dist)}m).`,
          category: "location",
          kind: "system",
          severity: "info",
          source: "device_gps",
          payload: { geo_capture_id: captureId, distance_m: dist },
          dedupe_key: propertyDedupeKey(propertyId ?? captureId, "location.gps_verified"),
        });
      } else {
        await emitSignal(admin, {
          org_id: orgId,
          property_id: propertyId ?? undefined,
          subtype: "location.off_site_completion",
          title: "Off-site completion flagged",
          body: `Completion recorded ${Math.round(dist)}m from ${propertyName}. Review recommended.`,
          category: "location",
          kind: "system",
          severity: "warning",
          source: "device_gps",
          disposition: "needs_review",
          payload: { geo_capture_id: captureId, distance_m: dist },
          dedupe_key: `${captureId}:off_site`,
        });
      }
    }

    // Nearby overdue tasks (operational)
    if (propertyId && body.scan_nearby) {
      const { data: overdueTasks } = await admin
        .from("tasks")
        .select("id, title, due_date")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .in("status", ["open", "in_progress"])
        .lt("due_date", new Date().toISOString())
        .limit(5);

      if (overdueTasks && overdueTasks.length > 0) {
        await emitSignal(admin, {
          org_id: orgId,
          property_id: propertyId,
          subtype: "operational.nearby_overdue",
          title: "Overdue work nearby",
          body: `${overdueTasks.length} overdue task(s) at this property while you are on site.`,
          category: "operational",
          kind: "system",
          severity: "urgent",
          source: "device_gps",
          disposition: "urgent",
          payload: { tasks: overdueTasks, geo_capture_id: captureId },
          dedupe_key: propertyDedupeKey(propertyId, "operational.nearby_overdue"),
        });
      }
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
