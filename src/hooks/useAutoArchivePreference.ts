import { useCallback, useEffect, useState } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  type AutoArchiveIntervalId,
  readAutoArchiveInterval,
  writeAutoArchiveInterval,
} from "@/lib/autoArchive";

export function useAutoArchivePreference() {
  const { orgId } = useActiveOrg();
  const [intervalId, setIntervalIdState] = useState<AutoArchiveIntervalId | null>(() =>
    readAutoArchiveInterval(orgId)
  );

  useEffect(() => {
    setIntervalIdState(readAutoArchiveInterval(orgId));
  }, [orgId]);

  const setIntervalId = useCallback(
    (next: AutoArchiveIntervalId | null) => {
      if (!orgId) return;
      writeAutoArchiveInterval(orgId, next);
      setIntervalIdState(next);
    },
    [orgId]
  );

  const toggleInterval = useCallback(
    (id: AutoArchiveIntervalId) => {
      setIntervalId(intervalId === id ? null : id);
    },
    [intervalId, setIntervalId]
  );

  return { orgId, intervalId, setIntervalId, toggleInterval };
}
