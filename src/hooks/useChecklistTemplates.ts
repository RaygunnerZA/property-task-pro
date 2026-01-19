import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ChecklistTemplateRow = Tables<"checklist_templates">;
type ChecklistTemplateItemRow = Tables<"checklist_template_items">;

export interface TemplateWithItems extends ChecklistTemplateRow {
  items: ChecklistTemplateItemRow[];
}

export function useChecklistTemplates() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [templates, setTemplates] = useState<ChecklistTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTemplates() {
    if (!orgId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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
        setTemplates([]);
        setError(null); // Don't set error state if table just doesn't exist yet
      } else {
        setError(err.message);
      }
    } else {
      setTemplates(data ?? []);
      setError(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchTemplates();
    }
  }, [orgId, orgLoading]);

  return { templates, loading, error, refresh: fetchTemplates };
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

    if (err) setError(err.message);
    else setItems(data ?? []);

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
      setError(templateErr.message);
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
      setError(itemsErr.message);
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
