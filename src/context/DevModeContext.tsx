/**
 * DevModeContext — Global development mode state.
 *
 * Enables:
 *   - Role override without re-login
 *   - Time simulation for compliance testing
 *   - Network latency simulation
 *   - AI debug panel visibility
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
  type ReactNode,
} from "react";

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

const DevModeContext = createContext<DevModeContextValue>({
  ...DEFAULT_STATE,
  ...NOOP_ACTIONS,
});

function isDevAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  return false;
}

export function DevModeProvider({ children }: { children: ReactNode }) {
  if (!isDevAllowed()) {
    return (
      <DevModeContext.Provider value={{ ...DEFAULT_STATE, ...NOOP_ACTIONS }}>
        {children}
      </DevModeContext.Provider>
    );
  }

  return <DevModeProviderInner>{children}</DevModeProviderInner>;
}

function DevModeProviderInner({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DevModeState>(DEFAULT_STATE);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, enabled: value }));
  }, []);

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
  }, []);

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
