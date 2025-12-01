import { createContext, useContext, ReactNode, useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type SystemStatus = "healthy" | "degraded" | "offline" | "critical";

interface SystemStatusContextValue {
  status: SystemStatus;
  isOnline: boolean;
  supabaseHealthy: boolean;
  lastError: string | null;
  setError: (msg: string | null) => void;
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

  // Heartbeat: ping Supabase every 45 seconds
  useEffect(() => {
    async function heartbeat() {
      if (!isOnline) {
        setSupabaseHealthy(false);
        return;
      }

      try {
        const { error } = await supabase
          .from("organisations")
          .select("id")
          .limit(1);

        if (error) {
          setSupabaseHealthy(false);
          setLastError("Unable to reach database");
        } else {
          setSupabaseHealthy(true);
          // Clear error on successful connection
          if (lastError === "Unable to reach database") {
            setLastError(null);
          }
        }
      } catch (err: any) {
        setSupabaseHealthy(false);
        setLastError("Connection issue detected");
      }
    }

    // Run immediately
    heartbeat();

    // Then every 45 seconds
    heartbeatRef.current = setInterval(heartbeat, 45000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [isOnline, lastError]);

  const value: SystemStatusContextValue = {
    status,
    isOnline,
    supabaseHealthy,
    lastError,
    setError: setLastError,
  };

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
    </SystemStatusContext.Provider>
  );
}
