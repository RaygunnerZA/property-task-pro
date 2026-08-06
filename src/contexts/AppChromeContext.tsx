import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AppChromeContextValue = {
  /** True when a route renders {@link GlobalAppHeader} / workbench gradient chrome. */
  ownsHeader: boolean;
  registerHeaderOwner: () => () => void;
};

const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [ownerCount, setOwnerCount] = useState(0);

  const registerHeaderOwner = useCallback(() => {
    setOwnerCount((count) => count + 1);
    return () => setOwnerCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      ownsHeader: ownerCount > 0,
      registerHeaderOwner,
    }),
    [ownerCount, registerHeaderOwner]
  );

  return (
    <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>
  );
}

export function useAppChrome() {
  return useContext(AppChromeContext);
}

/** Register that this tree owns the full-bleed logo / gradient / search header. */
export function useRegisterAppChromeHeader() {
  const ctx = useContext(AppChromeContext);

  useLayoutEffect(() => {
    if (!ctx) return;
    return ctx.registerHeaderOwner();
  }, [ctx]);
}
