import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ChecklistTemplateRow = Tables<"checklist_templates">;
type ChecklistTemplateItemRow = Tables<"checklist_template_items">;
export type ChecklistTemplateCategory =
  | "compliance"
  | "maintenance"
  | "security"
  | "operations";

export interface ChecklistTemplate extends ChecklistTemplateRow {
  category: ChecklistTemplateCategory;
}

export interface TemplateWithItems extends ChecklistTemplate {
  items: ChecklistTemplateItemRow[];
}

export function useChecklistTemplates(enabled: boolean = true) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const toCategory = (value: unknown): ChecklistTemplateCategory => {
    if (value === "compliance" || value === "maintenance" || value === "security") {
      return value;
    }
    return "operations";
  };

  const fetchTemplates = async (): Promise<ChecklistTemplate[]> => {
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
      // Handle PGRST205 (table not found) gracefully - table may not exist yet if migration hasn't been run
      // This is expected during development and should not be treated as a user-facing error
      if (err.code === 'PGRST205') {
        // Table doesn't exist - silently return empty array
        return [];
      } else {
        throw err;
      }
    }

    return (data ?? []).map((template) => ({
      ...template,
      category: toCategory((template as { category?: string }).category),
    }));
  };

  const templatesQuery = useQuery({
    queryKey: ["checklist-templates", orgId, enabled],
    queryFn: fetchTemplates,
    enabled: !orgLoading && enabled,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    templates: enabled ? (templatesQuery.data ?? []) : [],
    loading: enabled ? templatesQuery.isLoading : false,
    error: enabled && templatesQuery.error ? (templatesQuery.error as Error).message : null,
    refresh: async () => {
      await templatesQuery.refetch();
    },
  };
}

export function useChecklistTemplateItems(templateId?: string) {
  const [items, setItems] = useState<ChecklistTemplateItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchItems() {
    if (!templateId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("checklist_template_items")
      .select("*")
      .eq("template_id", templateId)
      .eq("is_archived", false)
      .order("order_index", { ascending: true });

    if (err) {
      // Handle PGRST205 (table not found) gracefully
      if (err.code === 'PGRST205') {
        setItems([]);
        setError(null);
      } else {
        setError(err.message);
      }
    } else {
      setItems(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, [templateId]);

  return { items, loading, error, refresh: fetchItems };
}

export function useTemplateWithItems(templateId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [template, setTemplate] = useState<TemplateWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTemplate() {
    if (!orgId || !templateId) {
      setTemplate(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch template
    const { data: templateData, error: templateErr } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateErr) {
      // Handle PGRST205 (table not found) gracefully
      if (templateErr.code === 'PGRST205') {
        setTemplate(null);
        setError(null);
      } else {
        setError(templateErr.message);
      }
      setLoading(false);
      return;
    }

    // Fetch items
    const { data: itemsData, error: itemsErr } = await supabase
      .from("checklist_template_items")
      .select("*")
      .eq("template_id", templateId)
      .eq("is_archived", false)
      .order("order_index", { ascending: true });

    if (itemsErr) {
      // Handle PGRST205 (table not found) gracefully
      if (itemsErr.code === 'PGRST205') {
        setTemplate({
          ...templateData,
          items: [],
        });
        setError(null);
      } else {
        setError(itemsErr.message);
      }
      setLoading(false);
      return;
    }

    setTemplate({
      ...templateData,
      items: itemsData ?? [],
    });

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchTemplate();
    }
  }, [orgId, templateId, orgLoading]);

  return { template, loading, error, refresh: fetchTemplate };
}
