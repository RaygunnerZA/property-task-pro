import { createContext, useContext, ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type SystemStatus = "healthy" | "degraded" | "offline" | "critical";

interface SystemStatusContextValue {
  status: SystemStatus;
  isOnline: boolean;
  supabaseHealthy: boolean;
  lastError: string | null;
  setError: (msg: string | null) => void;
  reconnect: () => Promise<void>;
}

const SystemStatusContext = createContext<SystemStatusContextValue | undefined>(undefined);

export function useSystemStatusContext() {
  const context = useContext(SystemStatusContext);
  if (!context) {
    throw new Error("useSystemStatusContext must be used within SystemStatusProvider");
  }
  return context;
}

// Export singleton for safeCall
export const systemStatus = {
  setError: (_msg: string | null) => {
    // Will be replaced by actual implementation
  }
};

interface SystemStatusProviderProps {
  children: ReactNode;
}

export function SystemStatusProvider({ children }: SystemStatusProviderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [supabaseHealthy, setSupabaseHealthy] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [status, setStatus] = useState<SystemStatus>("healthy");
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Update singleton reference
  useEffect(() => {
    systemStatus.setError = setLastError;
  }, []);

  // Browser online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Calculate derived status
  useEffect(() => {
    if (!isOnline) {
      setStatus("offline");
    } else if (!supabaseHealthy && lastError) {
      setStatus("critical");
    } else if (!supabaseHealthy) {
      setStatus("degraded");
    } else {
      setStatus("healthy");
    }
  }, [isOnline, supabaseHealthy, lastError]);

  // Heartbeat function - checks Supabase connection
  const heartbeat = useCallback(async () => {
    if (!isOnline) {
      setSupabaseHealthy(false);
      return;
    }

    try {
      // Connectivity check only (must not mutate auth state)
      const { error } = await supabase
        .from("organisations")
        .select("id")
        .limit(1);

      if (error) {
        // Permission errors (401/403) are auth issues, not connection issues
        const isAuthError = error.code === "42501" || error.message?.includes("permission denied");
        if (isAuthError) {
          // User not logged in - this is expected, not a connection problem
          setSupabaseHealthy(true);
          setLastError(null);
        } else {
          setSupabaseHealthy(false);
          setLastError("Unable to reach database");
        }
      } else {
        setSupabaseHealthy(true);
        setLastError(null);
      }
    } catch (err: any) {
      setSupabaseHealthy(false);
      setLastError("Connection issue detected");
    }
  }, [isOnline]);

  // Manual reconnect function
  const reconnect = useCallback(async () => {
    setLastError(null);
    await heartbeat();
  }, [heartbeat]);

  // Heartbeat: ping Supabase every 45 seconds
  useEffect(() => {
    // Run immediately
    heartbeat();

    // Then every 45 seconds
    heartbeatRef.current = setInterval(heartbeat, 45000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [heartbeat]);

  const value: SystemStatusContextValue = {
    status,
    isOnline,
    supabaseHealthy,
    lastError,
    setError: setLastError,
    reconnect,
  };

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
    </SystemStatusContext.Provider>
  );
}
