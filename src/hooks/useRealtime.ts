import { supabase } from "../integrations/supabase/client";
import { useEffect } from "react";

export function useRealtime(channelName: string, table: string, callback: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => callback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, callback]);
}
