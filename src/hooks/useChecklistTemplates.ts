import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type ChecklistTemplateRow = Tables<"checklist_templates">;
type ChecklistTemplateItemRow = Tables<"checklist_template_items">;

export interface TemplateWithItems extends ChecklistTemplateRow {
  items: ChecklistTemplateItemRow[];
}

/**
 * Hook to fetch checklist templates for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns Templates array, loading state, error state, and refresh function
 */
export function useChecklistTemplates() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: templates = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.checklistTemplates(orgId ?? undefined),
    queryFn: async (): Promise<ChecklistTemplateRow[]> => {
      if (!orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_archived", false)
        .order("name", { ascending: true });

      if (err) {
        // Table might not exist yet (404) or RLS might be blocking - log but don't fail completely
        // Supabase REST API returns 404 for non-existent tables, 42P01 is Postgres error code
        if (err.code === '42P01' || err.code === 'PGRST116' || err.message?.includes('does not exist') || (err as any)?.status === 404) {
          console.warn('[useChecklistTemplates] checklist_templates table does not exist yet or is not accessible:', err.code, err.message);
          return []; // Return empty array if table doesn't exist
        }
        throw err; // Throw other errors
      }

      return (data as ChecklistTemplateRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 5 * 60 * 1000, // 5 minutes - templates change infrequently
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    templates,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}

/**
 * Hook to fetch checklist template items for a specific template.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param templateId - The template ID to fetch items for
 * @returns Template items array, loading state, error state, and refresh function
 */
export function useChecklistTemplateItems(templateId?: string) {
  const { data: items = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.checklistTemplateItems(templateId),
    queryFn: async (): Promise<ChecklistTemplateItemRow[]> => {
      if (!templateId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("checklist_template_items")
        .select("*")
        .eq("template_id", templateId)
        .eq("is_archived", false)
        .order("order_index", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as ChecklistTemplateItemRow[]) ?? [];
    },
    enabled: !!templateId, // Only fetch when we have templateId
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    items,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}

/**
 * Hook to fetch a checklist template with its items.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param templateId - The template ID to fetch
 * @returns Template with items, loading state, error state, and refresh function
 */
export function useTemplateWithItems(templateId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: template, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.checklistTemplateWithItems(orgId ?? undefined, templateId),
    queryFn: async (): Promise<TemplateWithItems | null> => {
      if (!orgId || !templateId) {
        return null;
      }

      // Fetch template
      const { data: templateData, error: templateErr } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateErr) {
        throw templateErr;
      }

      // Fetch items
      const { data: itemsData, error: itemsErr } = await supabase
        .from("checklist_template_items")
        .select("*")
        .eq("template_id", templateId)
        .eq("is_archived", false)
        .order("order_index", { ascending: true });

      if (itemsErr) {
        throw itemsErr;
      }

      return {
        ...templateData,
        items: itemsData ?? [],
      } as TemplateWithItems;
    },
    enabled: !!orgId && !!templateId && !orgLoading, // Only fetch when we have orgId and templateId
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    template: template ?? null,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
