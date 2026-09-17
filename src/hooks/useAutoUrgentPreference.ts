import { useCallback, useSyncExternalStore } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  DEFAULT_AUTO_URGENT_HORIZON,
  readAutoUrgentHorizon,
  subscribeAutoUrgentHorizon,
  writeAutoUrgentHorizon,
  type AutoUrgentHorizonId,
} from "@/lib/autoUrgent";

export function useAutoUrgentPreference() {
  const { orgId } = useActiveOrg();
  const horizonId = useSyncExternalStore(
    subscribeAutoUrgentHorizon,
    () => readAutoUrgentHorizon(orgId),
    () => DEFAULT_AUTO_URGENT_HORIZON
  );

  const setHorizonId = useCallback(
    (next: AutoUrgentHorizonId) => {
      if (!orgId) return;
      writeAutoUrgentHorizon(orgId, next);
    },
    [orgId]
  );

  return { orgId, horizonId, setHorizonId };
}
