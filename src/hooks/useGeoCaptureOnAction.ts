import { useCallback } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { captureGeoForAction, type GeoCaptureContext } from "@/services/location/geoCapture";

export function useGeoCaptureOnAction() {
  const { orgId } = useActiveOrg();

  const capture = useCallback(
    (
      context: GeoCaptureContext,
      opts?: {
        propertyId?: string | null;
        taskId?: string | null;
        attachmentId?: string | null;
        assetId?: string | null;
        scanNearby?: boolean;
      }
    ) => {
      if (!orgId) return;
      void captureGeoForAction(orgId, context, opts);
    },
    [orgId]
  );

  return { capture };
}
