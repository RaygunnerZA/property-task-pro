import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TASK_OPEN_MODE,
  readStoredTaskOpenMode,
  writeStoredTaskOpenMode,
  type TaskOpenMode,
} from "@/lib/taskOpenMode";

/**
 * Persisted preference for wide-screen task open: right column panel vs fullscreen modal.
 */
export function useTaskOpenMode() {
  const [mode, setModeState] = useState<TaskOpenMode>(DEFAULT_TASK_OPEN_MODE);

  useEffect(() => {
    setModeState(readStoredTaskOpenMode());
  }, []);

  const setMode = useCallback((next: TaskOpenMode) => {
    setModeState(next);
    writeStoredTaskOpenMode(next);
  }, []);

  return { mode, setMode } as const;
}
