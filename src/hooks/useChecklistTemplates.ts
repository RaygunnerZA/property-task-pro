import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ChecklistTemplateRow = Tables<"checklist_templates">;
type ChecklistTemplateItemRow = Tables<"checklist_template_items">;

export interface TemplateWithItems extends ChecklistTemplateRow {
  items: ChecklistTemplateItemRow[];
}

// Track if table doesn't exist to prevent repeated requests
let tableDoesNotExist = false;

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

    // If we know the table doesn't exist, don't make the request
    if (tableDoesNotExist) {
      setTemplates([]);
      setLoading(false);
      setError(null);
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
      // If table doesn't exist (404/PGRST205), mark it and stop making requests
      if (err.code === 'PGRST116' || err.code === 'PGRST205' || err.message?.includes('404') || err.message?.includes('does not exist') || err.message?.includes('Could not find the table')) {
        console.warn('[checklist_templates] Table does not exist, feature disabled');
        tableDoesNotExist = true; // Mark so we don't make more requests
        setTemplates([]);
        setError(null); // Don't show error to user for missing table
      } else {
        console.error('checklist_templates query error:', err);
        setError(err.message);
      }
    } else {
      // Table exists, reset the flag in case it was set before
      tableDoesNotExist = false;
      setTemplates(data ?? []);
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

    // If we know the table doesn't exist, don't make the request
    if (tableDoesNotExist) {
      setTemplate(null);
      setLoading(false);
      setError(null);
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
      // If table doesn't exist (404/PGRST205), mark it and stop making requests
      if (templateErr.code === 'PGRST116' || templateErr.code === 'PGRST205' || templateErr.message?.includes('404') || templateErr.message?.includes('does not exist') || templateErr.message?.includes('Could not find the table')) {
        tableDoesNotExist = true; // Mark so we don't make more requests
        setTemplate(null);
        setError(null);
        setLoading(false);
        return;
      }
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
