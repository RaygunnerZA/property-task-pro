import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

type PlanFile = {
  id: string;
  file_name: string;
  status: string;
  page_count: number | null;
  created_at: string;
  error_message?: string | null;
};

type ExtractionRun = {
  id: string;
  plan_file_id: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
};

export type ExtractedRow = {
  id: string;
  name?: string;
  title?: string;
  space_type?: string | null;
  asset_type?: string | null;
  element_type?: string | null;
  suggestion_type?: string | null;
  confidence: number;
  is_accepted: boolean;
  edited_name?: string | null;
  edited_space_type?: string | null;
  edited_asset_type?: string | null;
  edited_element_type?: string | null;
  source_page_id?: string | null;
  rationale?: string | null;
};

const db = supabase as any;

export function useBuildingPlans(propertyId?: string) {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();

  const filesQuery = useQuery({
    queryKey: ["building-plans", "files", orgId, propertyId],
    enabled: Boolean(orgId && propertyId),
    queryFn: async (): Promise<PlanFile[]> => {
      const { data, error } = await db
        .from("property_plan_files")
        .select("id, file_name, status, page_count, created_at, error_message")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const latestRunByFileQuery = useQuery({
    queryKey: ["building-plans", "latest-run-by-file", orgId, propertyId],
    enabled: Boolean(orgId && propertyId),
    queryFn: async (): Promise<Record<string, ExtractionRun>> => {
      const { data, error } = await db
        .from("plan_extraction_runs")
        .select("id, plan_file_id, status, created_at, completed_at")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, ExtractionRun> = {};
      for (const run of data || []) {
        if (!map[run.plan_file_id]) map[run.plan_file_id] = run;
      }
      return map;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!orgId || !propertyId) return [];
      const createdFileIds: string[] = [];
      const {
        data: { user },
      } = await db.auth.getUser();
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `orgs/${orgId}/properties/${propertyId}/plans/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await db.storage
          .from("property-plans")
          .upload(storagePath, file, { upsert: false, cacheControl: "3600" });
        if (uploadError) throw uploadError;

        const { data: row, error: insertError } = await db
          .from("property_plan_files")
          .insert({
            org_id: orgId,
            property_id: propertyId,
            uploaded_by: user?.id ?? null,
            file_name: file.name,
            mime_type: file.type || null,
            storage_path: storagePath,
            file_size: file.size,
            status: "uploaded",
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        createdFileIds.push(row.id);
        db.functions
          .invoke("building-plan-process", { body: { plan_file_id: row.id } })
          .catch(() => undefined);
      }
      return createdFileIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans", "files"] });
      queryClient.invalidateQueries({ queryKey: ["building-plans", "latest-run-by-file"] });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["building-plans"] });
  };

  return {
    orgId,
    files: filesQuery.data || [],
    latestRunByFile: latestRunByFileQuery.data || {},
    isLoading: filesQuery.isLoading || latestRunByFileQuery.isLoading,
    isUploading: uploadMutation.isPending,
    uploadPlans: uploadMutation.mutateAsync,
    refresh,
  };
}

export function usePlanExtraction(runId?: string) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ["building-plans", "run", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async () => {
      const { data, error } = await db
        .from("plan_extraction_runs")
        .select("id, plan_file_id, status, model_name, created_at, completed_at, error_message")
        .eq("id", runId)
        .eq("org_id", orgId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const pagesQuery = useQuery({
    queryKey: ["building-plans", "pages", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async () => {
      const { data: runRow, error: runError } = await db
        .from("plan_extraction_runs")
        .select("plan_file_id")
        .eq("id", runId)
        .eq("org_id", orgId)
        .single();
      if (runError) throw runError;
      const { data, error } = await db
        .from("property_plan_pages")
        .select("id, page_number, processing_status, image_storage_path, thumbnail_storage_path")
        .eq("plan_file_id", runRow.plan_file_id)
        .eq("org_id", orgId)
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const spacesQuery = useQuery({
    queryKey: ["building-plans", "items", "spaces", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async (): Promise<ExtractedRow[]> => {
      const { data, error } = await db
        .from("extracted_spaces")
        .select("id, name, space_type, confidence, is_accepted, edited_name, edited_space_type, source_page_id")
        .eq("extraction_run_id", runId)
        .eq("org_id", orgId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["building-plans", "items", "assets", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async (): Promise<ExtractedRow[]> => {
      const { data, error } = await db
        .from("extracted_assets")
        .select("id, name, asset_type, confidence, is_accepted, edited_name, edited_asset_type, source_page_id")
        .eq("extraction_run_id", runId)
        .eq("org_id", orgId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const complianceQuery = useQuery({
    queryKey: ["building-plans", "items", "compliance", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async (): Promise<ExtractedRow[]> => {
      const { data, error } = await db
        .from("extracted_compliance_elements")
        .select("id, name, element_type, confidence, is_accepted, edited_name, edited_element_type, source_page_id")
        .eq("extraction_run_id", runId)
        .eq("org_id", orgId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["building-plans", "items", "tasks", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async (): Promise<ExtractedRow[]> => {
      const { data, error } = await db
        .from("extracted_task_suggestions")
        .select("id, title, suggestion_type, rationale, confidence, is_accepted, source_page_id")
        .eq("extraction_run_id", runId)
        .eq("org_id", orgId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      table,
      id,
      values,
    }: {
      table:
        | "extracted_spaces"
        | "extracted_assets"
        | "extracted_compliance_elements"
        | "extracted_task_suggestions";
      id: string;
      values: Record<string, unknown>;
    }) => {
      const { error } = await db.from(table).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans", "items"] });
      queryClient.invalidateQueries({ queryKey: ["building-plans", "files"] });
      if (runQuery.data?.plan_file_id) {
        db.from("property_plan_files")
          .update({ status: "partially_reviewed" })
          .eq("id", runQuery.data.plan_file_id)
          .in("status", ["ready_for_review", "partially_reviewed"])
          .then(() => undefined)
          .catch(() => undefined);
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("import_plan_extraction_run", {
        p_extraction_run_id: runId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const state = useMemo(() => {
    const spaces = spacesQuery.data || [];
    const assets = assetsQuery.data || [];
    const compliance = complianceQuery.data || [];
    const tasks = tasksQuery.data || [];
    return { spaces, assets, compliance, tasks };
  }, [spacesQuery.data, assetsQuery.data, complianceQuery.data, tasksQuery.data]);

  return {
    run: runQuery.data,
    pages: pagesQuery.data || [],
    items: state,
    isLoading:
      runQuery.isLoading ||
      pagesQuery.isLoading ||
      spacesQuery.isLoading ||
      assetsQuery.isLoading ||
      complianceQuery.isLoading ||
      tasksQuery.isLoading,
    updateItem: updateItemMutation.mutateAsync,
    isUpdating: updateItemMutation.isPending,
    importAccepted: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
  };
}
