/**
 * DevModeContext — Global development mode state.
 *
 * Enables:
 *   - Role override without re-login
 *   - Time simulation for compliance testing
 *   - Network latency simulation
 *   - AI debug panel visibility
 *   - When ON: JWT app_metadata.dev_mode (via sync-dev-mode edge function) so RLS shows all org tasks/files
 *
 * Active when:
 *   - Local dev (import.meta.env.DEV), or
 *   - Deployed "development" build (VITE_APP_DEV_BUILD=true) so this org/build can see everything by default; only you can switch off.
 */

/** True when dev mode UI and "see everything" default should be available (local dev or deployed dev build). */
export const isDevBuild =
  import.meta.env.DEV || import.meta.env.VITE_APP_DEV_BUILD === "true";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useQueryClient } from "@tanstack/react-query";

export type DevUserRole = "manager" | "contractor" | "vendor" | "admin";

export interface DevModeState {
  enabled: boolean;
  userRoleOverride: DevUserRole | null;
  simulateSlowNetwork: boolean;
  simulateTimeShiftDays: number;
  showAIDebugPanel: boolean;
  showViewportSimulator: boolean;
  createTaskDiagnostics: boolean;
}

interface DevModeActions {
  toggle: () => void;
  setEnabled: (value: boolean) => void;
  setUserRoleOverride: (role: DevUserRole | null) => void;
  setSimulateSlowNetwork: (value: boolean) => void;
  setSimulateTimeShiftDays: (days: number) => void;
  setShowAIDebugPanel: (value: boolean) => void;
  setShowViewportSimulator: (value: boolean) => void;
  setCreateTaskDiagnostics: (value: boolean) => void;
  reset: () => void;
}

type DevModeContextValue = DevModeState & DevModeActions;

const DEFAULT_STATE: DevModeState = {
  enabled: false,
  userRoleOverride: null,
  simulateSlowNetwork: false,
  simulateTimeShiftDays: 0,
  showAIDebugPanel: false,
  showViewportSimulator: false,
  createTaskDiagnostics: false,
};

const NOOP_ACTIONS: DevModeActions = {
  toggle: () => {},
  setEnabled: () => {},
  setUserRoleOverride: () => {},
  setSimulateSlowNetwork: () => {},
  setSimulateTimeShiftDays: () => {},
  setShowAIDebugPanel: () => {},
  setShowViewportSimulator: () => {},
  setCreateTaskDiagnostics: () => {},
  reset: () => {},
};

const PRODUCTION_VALUE: DevModeContextValue = {
  ...DEFAULT_STATE,
  ...NOOP_ACTIONS,
};

const DevModeContext = createContext<DevModeContextValue>(PRODUCTION_VALUE);

export function DevModeProvider({ children }: { children: ReactNode }) {
  if (!isDevBuild) {
    return (
      <DevModeContext.Provider value={PRODUCTION_VALUE}>
        {children}
      </DevModeContext.Provider>
    );
  }

  return <DevModeProviderInner>{children}</DevModeProviderInner>;
}

// In dev, default to enabled so both accounts see all tasks/files without toggling
const DEV_DEFAULT_STATE: DevModeState = { ...DEFAULT_STATE, enabled: true };

function DevModeProviderInner({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [state, setState] = useState<DevModeState>(DEV_DEFAULT_STATE);

  // Default ON in this build: sync app_metadata via edge function (RLS reads app_metadata, not user_metadata)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const devMode = session.user.app_metadata?.dev_mode;
      const alreadyOn = devMode === true || devMode === "true";
      if (alreadyOn) {
        setState((prev) => (prev.enabled ? prev : { ...prev, enabled: true }));
      } else {
        setState((prev) => (prev.enabled ? prev : { ...prev, enabled: true }));
        const { error } = await supabase.functions.invoke("sync-dev-mode", {
          body: { enabled: true },
        });
        if (!error) {
          await supabase.auth.refreshSession();
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
        }
      }
    });
  }, [supabase, queryClient]);

  const syncDevModeToJwt = useCallback(
    async (enabled: boolean) => {
      try {
        const { error } = await supabase.functions.invoke("sync-dev-mode", {
          body: { enabled },
        });
        if (error) return;
        await supabase.auth.refreshSession();
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      } catch {
        // Ignore: user may be logged out or session invalid
      }
    },
    [supabase, queryClient]
  );

  const toggle = useCallback(() => {
    setState((prev) => {
      const next = !prev.enabled;
      syncDevModeToJwt(next);
      return { ...prev, enabled: next };
    });
  }, [syncDevModeToJwt]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setState((prev) => ({ ...prev, enabled: value }));
      syncDevModeToJwt(value);
    },
    [syncDevModeToJwt]
  );

  const setUserRoleOverride = useCallback((role: DevUserRole | null) => {
    setState((prev) => ({ ...prev, userRoleOverride: role }));
  }, []);

  const setSimulateSlowNetwork = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, simulateSlowNetwork: value }));
  }, []);

  const setSimulateTimeShiftDays = useCallback((days: number) => {
    setState((prev) => ({ ...prev, simulateTimeShiftDays: days }));
  }, []);

  const setShowAIDebugPanel = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, showAIDebugPanel: value }));
  }, []);

  const setShowViewportSimulator = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, showViewportSimulator: value }));
  }, []);

  const setCreateTaskDiagnostics = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, createTaskDiagnostics: value }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    syncDevModeToJwt(false);
  }, [syncDevModeToJwt]);

  const value = useMemo<DevModeContextValue>(
    () => ({
      ...state,
      toggle,
      setEnabled,
      setUserRoleOverride,
      setSimulateSlowNetwork,
      setSimulateTimeShiftDays,
      setShowAIDebugPanel,
      setShowViewportSimulator,
      setCreateTaskDiagnostics,
      reset,
    }),
    [
      state,
      toggle,
      setEnabled,
      setUserRoleOverride,
      setSimulateSlowNetwork,
      setSimulateTimeShiftDays,
      setShowAIDebugPanel,
      setShowViewportSimulator,
      setCreateTaskDiagnostics,
      reset,
    ]
  );

  return (
    <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeContextValue {
  return useContext(DevModeContext);
}
