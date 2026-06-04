import { supabase } from "@/integrations/supabase/client";
import type { GeoPosition } from "@/hooks/useOneShotGeolocation";

export type GeoCaptureContext =
  | "task_complete"
  | "inspection_complete"
  | "photo_upload"
  | "asset_verify"
  | "compliance_record"
  | "site_visit";

interface GeoCaptureInput {
  orgId: string;
  position: GeoPosition;
  context: GeoCaptureContext;
  propertyId?: string | null;
  taskId?: string | null;
  attachmentId?: string | null;
  assetId?: string | null;
  scanNearby?: boolean;
}

export async function recordGeoCapture(input: GeoCaptureInput): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("geo_captures")
    .insert({
      org_id: input.orgId,
      user_id: userId,
      property_id: input.propertyId ?? null,
      task_id: input.taskId ?? null,
      attachment_id: input.attachmentId ?? null,
      asset_id: input.assetId ?? null,
      latitude: input.position.latitude,
      longitude: input.position.longitude,
      accuracy_m: input.position.accuracyM,
      capture_context: input.context,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.warn("geo_captures insert failed:", error.message);
    return null;
  }

  const captureId = (data as { id: string }).id;

  void supabase.functions.invoke("signal-engine", {
    body: {
      action: "assess_geo_capture",
      geo_capture_id: captureId,
      scan_nearby: input.scanNearby === true,
    },
  });

  return captureId;
}

/** Fire-and-forget one-shot GPS capture for work actions (never blocks completion). */
export async function captureGeoForAction(
  orgId: string,
  context: GeoCaptureContext,
  opts?: {
    propertyId?: string | null;
    taskId?: string | null;
    attachmentId?: string | null;
    assetId?: string | null;
    scanNearby?: boolean;
  }
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;

  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void recordGeoCapture({
          orgId,
          context,
          propertyId: opts?.propertyId,
          taskId: opts?.taskId,
          attachmentId: opts?.attachmentId,
          assetId: opts?.assetId,
          scanNearby: opts?.scanNearby,
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: pos.coords.accuracy ?? null,
          },
        });
        resolve();
      },
      () => resolve(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  });
}
