/**
 * Phase 12C: Icon library search hook
 * Uses ai_icon_search RPC for semantic icon lookup.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IconLibraryRow {
  id: string;
  name: string;
  tags?: string[];
  category?: string | null;
  search_vector?: unknown;
}

export function useIconLibraryQuery(search: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["icon-library", search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ai_icon_search", {
        query_text: search.trim() || "",
      });
      if (error) throw error;
      return (data ?? []) as IconLibraryRow[];
    },
    enabled: options?.enabled !== false,
  });
}
