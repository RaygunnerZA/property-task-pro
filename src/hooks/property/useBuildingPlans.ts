import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export type PlanFile = {
  id: string;
  file_name: string;
  status: string;
  page_count: number | null;
  created_at: string;
  error_message?: string | null;
  building_label?: string | null;
  floor_label?: string | null;
  setup_notes?: string | null;
  scale_known?: boolean | null;
  units?: string | null;
};

type ExtractionRun = {
  id: string;
  plan_file_id: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
};

export type PlanSetupInput = {
  building_label: string;
  floor_label: string;
  setup_notes?: string;
  scale_known?: boolean;
  units?: string;
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
  floor_label?: string | null;
  review_band?: string | null;
  raw_reference?: Record<string, unknown> | null;
};

export type PlanPagePreview = {
  id: string;
  page_number: number;
  processing_status: string;
  image_storage_path: string | null;
  thumbnail_storage_path: string | null;
  signedUrl: string | null;
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
        .select(
          "id, file_name, status, page_count, created_at, error_message, building_label, floor_label, setup_notes, scale_known, units"
        )
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
      }
      return createdFileIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans", "files"] });
      queryClient.invalidateQueries({ queryKey: ["building-plans", "latest-run-by-file"] });
    },
  });

  const saveSetupMutation = useMutation({
    mutationFn: async ({
      planFileId,
      setup,
    }: {
      planFileId: string;
      setup: PlanSetupInput;
    }) => {
      const { error } = await db
        .from("property_plan_files")
        .update({
          building_label: setup.building_label.trim() || null,
          floor_label: setup.floor_label.trim() || null,
          setup_notes: setup.setup_notes?.trim() || null,
          scale_known: setup.scale_known ?? null,
          units: setup.units?.trim() || null,
        })
        .eq("id", planFileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans", "files"] });
    },
  });

  const processMutation = useMutation({
    mutationFn: async ({
      planFileId,
      setup,
    }: {
      planFileId: string;
      setup?: PlanSetupInput;
    }) => {
      if (setup) {
        const { error: setupError } = await db
          .from("property_plan_files")
          .update({
            building_label: setup.building_label.trim() || null,
            floor_label: setup.floor_label.trim() || null,
            setup_notes: setup.setup_notes?.trim() || null,
            scale_known: setup.scale_known ?? null,
            units: setup.units?.trim() || null,
          })
          .eq("id", planFileId);
        if (setupError) throw setupError;
      }
      const { data, error } = await db.functions.invoke("building-plan-process", {
        body: {
          plan_file_id: planFileId,
          extract_mode: "spaces_only",
          building_label: setup?.building_label,
          floor_label: setup?.floor_label,
          setup_notes: setup?.setup_notes,
          scale_known: setup?.scale_known,
          units: setup?.units,
        },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Processing failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans"] });
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
    isProcessing: processMutation.isPending,
    isSavingSetup: saveSetupMutation.isPending,
    uploadPlans: uploadMutation.mutateAsync,
    saveSetup: saveSetupMutation.mutateAsync,
    proposeSpaces: processMutation.mutateAsync,
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
    queryFn: async (): Promise<PlanPagePreview[]> => {
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

      const pages = data || [];
      return Promise.all(
        pages.map(async (page: Omit<PlanPagePreview, "signedUrl">) => {
          if (!page.image_storage_path) {
            return { ...page, signedUrl: null };
          }
          const { data: signed } = await db.storage
            .from("property-plan-pages")
            .createSignedUrl(page.image_storage_path, 60 * 60);
          return { ...page, signedUrl: signed?.signedUrl ?? null };
        })
      );
    },
  });

  const spacesQuery = useQuery({
    queryKey: ["building-plans", "items", "spaces", runId, orgId],
    enabled: Boolean(runId && orgId),
    queryFn: async (): Promise<ExtractedRow[]> => {
      const { data, error } = await db
        .from("extracted_spaces")
        .select(
          "id, name, space_type, confidence, is_accepted, edited_name, edited_space_type, source_page_id, floor_label, review_band, raw_reference"
        )
        .eq("extraction_run_id", runId)
        .eq("org_id", orgId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return (data || []).map((row: ExtractedRow) => ({
        ...row,
        rationale:
          typeof row.raw_reference?.rationale === "string"
            ? (row.raw_reference.rationale as string)
            : null,
      }));
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      table,
      id,
      values,
    }: {
      table: "extracted_spaces";
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
      // Single-arg RPC defaults to spaces-only after building-setup-assistant migration.
      const { data, error } = await db.rpc("import_plan_extraction_run", {
        p_extraction_run_id: runId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["building-plans"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });

  const state = useMemo(() => {
    const spaces = spacesQuery.data || [];
    return { spaces };
  }, [spacesQuery.data]);

  return {
    run: runQuery.data,
    pages: pagesQuery.data || [],
    items: state,
    isLoading: runQuery.isLoading || pagesQuery.isLoading || spacesQuery.isLoading,
    updateItem: updateItemMutation.mutateAsync,
    isUpdating: updateItemMutation.isPending,
    importAccepted: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
  };
}
