import { useEffect, useState } from "react";
import {
  ALL_TASKS_ILLUSTRATION_PRIMARY,
  allTasksIllustrationSrc,
  readAllTasksIllustrationState,
  touchAllTasksIllustrationUsage,
} from "@/lib/allTasksIllustration";

/**
 * All-tasks header art: sequential primary → numbered alternates, then random,
 * advancing every few distinct days the workbench is used.
 */
export function useAllTasksIllustrationSrc(): string {
  const [src, setSrc] = useState(() =>
    typeof window === "undefined"
      ? ALL_TASKS_ILLUSTRATION_PRIMARY
      : allTasksIllustrationSrc(readAllTasksIllustrationState().index)
  );

  useEffect(() => {
    setSrc(touchAllTasksIllustrationUsage());
  }, []);

  return src;
}
