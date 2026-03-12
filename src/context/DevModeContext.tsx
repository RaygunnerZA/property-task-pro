/**
 * DevModeContext — Global development mode state.
 *
 * Enables:
 *   - Role override without re-login
 *   - Time simulation for compliance testing
 *   - Network latency simulation
 *   - AI debug panel visibility
 *   - When ON: JWT user_metadata.dev_mode = true so RLS shows all org tasks/files
 *
 * Production safety:
 *   Context is only active when `import.meta.env.DEV` or `?dev=true`.
 *   The provider short-circuits to a no-op in production builds.
 */

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

export type DevUserRole = "manager" | "contractor" | "vendor" | "admin";

export interface DevModeState {
  enabled: boolean;
  userRoleOverride: DevUserRole | null;
  simulateSlowNetwork: boolean;
  simulateTimeShiftDays: number;
  showAIDebugPanel: boolean;
  createTaskDiagnostics: boolean;
}

interface DevModeActions {
  toggle: () => void;
  setEnabled: (value: boolean) => void;
  setUserRoleOverride: (role: DevUserRole | null) => void;
  setSimulateSlowNetwork: (value: boolean) => void;
  setSimulateTimeShiftDays: (days: number) => void;
  setShowAIDebugPanel: (value: boolean) => void;
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
  createTaskDiagnostics: false,
};

const NOOP_ACTIONS: DevModeActions = {
  toggle: () => {},
  setEnabled: () => {},
  setUserRoleOverride: () => {},
  setSimulateSlowNetwork: () => {},
  setSimulateTimeShiftDays: () => {},
  setShowAIDebugPanel: () => {},
  setCreateTaskDiagnostics: () => {},
  reset: () => {},
};

const PRODUCTION_VALUE: DevModeContextValue = {
  ...DEFAULT_STATE,
  ...NOOP_ACTIONS,
};

const DevModeContext = createContext<DevModeContextValue>(PRODUCTION_VALUE);

export function DevModeProvider({ children }: { children: ReactNode }) {
  if (!import.meta.env.DEV) {
    return (
      <DevModeContext.Provider value={PRODUCTION_VALUE}>
        {children}
      </DevModeContext.Provider>
    );
  }

  return <DevModeProviderInner>{children}</DevModeProviderInner>;
}

function DevModeProviderInner({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [state, setState] = useState<DevModeState>(DEFAULT_STATE);

  // Hydrate enabled from JWT (user_metadata.dev_mode) so UI matches after refresh
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const devMode = session?.user?.user_metadata?.dev_mode;
      if (devMode === true || devMode === "true") {
        setState((prev) => (prev.enabled ? prev : { ...prev, enabled: true }));
      }
    });
  }, [supabase]);

  const syncDevModeToJwt = useCallback(
    async (enabled: boolean) => {
      try {
        await supabase.auth.updateUser({
          data: { dev_mode: enabled },
        });
        await supabase.auth.refreshSession();
      } catch {
        // Ignore: user may be logged out or session invalid
      }
    },
    [supabase]
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
