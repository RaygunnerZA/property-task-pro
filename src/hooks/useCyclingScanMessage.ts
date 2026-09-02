import { useEffect, useState } from "react";
import {
  INTAKE_DOC_SCAN_MESSAGES,
  INTAKE_IMAGE_SCAN_MESSAGES,
  intakeScanMessageAt,
} from "@/lib/intakeScanProgress";

/** Cycles Reading-document status copy while `active` is true. */
export function useCyclingScanMessage(
  active: boolean,
  variant: "document" | "image" = "document"
): string {
  const messages =
    variant === "image" ? INTAKE_IMAGE_SCAN_MESSAGES : INTAKE_DOC_SCAN_MESSAGES;
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return messages[0];
  return intakeScanMessageAt(messages, startedAt, now);
}
