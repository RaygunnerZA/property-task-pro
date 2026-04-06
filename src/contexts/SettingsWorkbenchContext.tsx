import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SetSettingsRightPanel = (node: ReactNode | null) => void;

export type SettingsWorkbenchValue = {
  setRightPanel: SetSettingsRightPanel;
  rightPanel: ReactNode | null;
};

const SettingsWorkbenchContext = createContext<SettingsWorkbenchValue | null>(null);

export function SettingsWorkbenchProvider({ children }: { children: ReactNode }) {
  const [rightPanel, setRightPanelState] = useState<ReactNode | null>(null);

  const setRightPanel = useCallback<SetSettingsRightPanel>((node) => {
    setRightPanelState(node);
  }, []);

  const value = useMemo(
    () => ({ setRightPanel, rightPanel }),
    [setRightPanel, rightPanel],
  );

  return (
    <SettingsWorkbenchContext.Provider value={value}>{children}</SettingsWorkbenchContext.Provider>
  );
}

export function useSettingsWorkbench() {
  const v = useContext(SettingsWorkbenchContext);
  if (!v) {
    throw new Error("useSettingsWorkbench must be used within SettingsWorkbenchProvider");
  }
  return v;
}
