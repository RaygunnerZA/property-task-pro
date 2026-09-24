/**
 * Loads IntakeModal only after the user opens intake (or once opened, keeps it for close animation).
 * Keeps the ~200KB composer out of the initial workbench shell.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import type { IntakeModalProps } from "@/components/intake/IntakeModal";

const IntakeModalLazy = lazy(() =>
  import("@/components/intake/IntakeModal").then((m) => ({ default: m.IntakeModal }))
);

export function LazyIntakeModal(props: IntakeModalProps) {
  const [shouldLoad, setShouldLoad] = useState(Boolean(props.open));

  useEffect(() => {
    if (props.open) setShouldLoad(true);
  }, [props.open]);

  if (!shouldLoad) return null;

  return (
    <Suspense fallback={null}>
      <IntakeModalLazy {...props} />
    </Suspense>
  );
}
