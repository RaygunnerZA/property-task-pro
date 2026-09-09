import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Annotation } from "@/types/image-annotations";
import { isPersistedAnnotationLayerId } from "@/lib/annotations/annotationEditSessions";

export interface AnnotationVersionEntry {
  id: string;
  created_at: string;
  created_by: string | null;
  version_number: number;
  label: string;
  annotations: Annotation[];
  is_enabled: boolean;
}

export type SaveAnnotationsOptions = {
  isAutosave?: boolean;
  /** Layers this edit replaces — set is_enabled=false, keep viewable in history. */
  supersedeLayerIds?: string[];
};

function isMissingRelationError(err: unknown) {
  const e = err as { message?: string; code?: string } | null;
  const msg = String(e?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("could not find the table") ||
    e?.code === "42P01" ||
    e?.code === "PGRST205"
  );
}

function asAnnotationArray(value: unknown): Annotation[] {
  return Array.isArray(value) ? (value as Annotation[]) : [];
}

/**
 * Build a composite of enabled layers (later layers draw on top).
 * When the same annotationId appears in multiple layers, the latest enabled wins.
 */
export function compositeAnnotations(layers: AnnotationVersionEntry[]): Annotation[] {
  const byId = new Map<string, Annotation>();
  const enabled = [...layers]
    .filter((l) => l.is_enabled)
    .sort((a, b) => a.version_number - b.version_number);
  for (const layer of enabled) {
    for (const ann of layer.annotations) {
      byId.set(ann.annotationId, ann);
    }
  }
  return Array.from(byId.values());
}

const LEGACY_JSON_LAYER_ID = "legacy-json";

function versionsTable() {
  // Table is ahead of generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from("task_image_annotation_versions");
}

export function useImageAnnotations(taskId: string, imageId: string) {
  const { orgId } = useActiveOrg();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationVersions, setAnnotationVersions] = useState<AnnotationVersionEntry[]>([]);
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  const fetchAnnotations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orgId || !taskId || !imageId) {
        setAnnotations([]);
        setAnnotationVersions([]);
        setSourceUpdatedAt(null);
        setLoading(false);
        return;
      }

      const silent = Boolean(opts?.silent) || hasLoadedRef.current;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const { data: versionRows, error: versionsError } = await versionsTable()
          .select("id, annotations, created_at, created_by, version_number, label, is_enabled")
          .eq("task_id", taskId)
          .eq("image_id", imageId)
          .order("version_number", { ascending: true })
          .limit(100);

        if (versionsError && !isMissingRelationError(versionsError)) throw versionsError;

        const { data: attachment } = await supabase
          .from("attachments")
          .select("annotation_json, updated_at")
          .eq("id", imageId)
          .maybeSingle();
        const jsonAnnotations = asAnnotationArray((attachment as any)?.annotation_json);
        const attachmentUpdatedAt = ((attachment as any)?.updated_at as string | undefined) ?? null;
        setSourceUpdatedAt(attachmentUpdatedAt);

        if (!versionsError && Array.isArray(versionRows) && versionRows.length > 0) {
          const mappedVersions: AnnotationVersionEntry[] = (versionRows as any[]).map((row) => ({
            id: row.id,
            created_at: row.created_at,
            created_by: row.created_by,
            version_number: row.version_number,
            label: row.label ?? `Edit ${row.version_number}`,
            annotations: asAnnotationArray(row.annotations),
            is_enabled: row.is_enabled !== false,
          }));
          const idsInVersions = new Set(
            mappedVersions.flatMap((layer) => layer.annotations.map((ann) => ann.annotationId)),
          );
          const leftovers = jsonAnnotations.filter((ann) => !idsInVersions.has(ann.annotationId));
          const withLeftovers =
            leftovers.length > 0
              ? [
                  {
                    id: LEGACY_JSON_LAYER_ID,
                    created_at: attachmentUpdatedAt ?? mappedVersions[0]?.created_at,
                    created_by: leftovers.find((ann) => ann.createdBy)?.createdBy ?? null,
                    version_number: 0,
                    label: "Earlier edits",
                    annotations: leftovers,
                    is_enabled: true,
                  },
                  ...mappedVersions,
                ]
              : mappedVersions;
          setAnnotationVersions(withLeftovers);
          setAnnotations(compositeAnnotations(withLeftovers));
        } else {
          setAnnotationVersions([]);
          setAnnotations(jsonAnnotations);
        }
      } catch (err: any) {
        if (err.code === "PGRST116" || err.status === 404 || err.message?.includes("404")) {
          setAnnotationVersions([]);
          setAnnotations([]);
          setError(null);
        } else {
          console.error("Error fetching annotations:", err);
          setError(err.message || "Failed to fetch annotations");
        }
      } finally {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    },
    [orgId, taskId, imageId]
  );

  const saveAnnotations = useCallback(
    async (layerDelta: Annotation[], options?: SaveAnnotationsOptions | boolean) => {
      if (!orgId || !taskId || !imageId) {
        throw new Error("Missing required IDs");
      }

      const opts: SaveAnnotationsOptions =
        typeof options === "boolean" ? { isAutosave: options } : options ?? {};
      const supersedeLayerIds = opts.supersedeLayerIds ?? [];

      // Empty autosave with nothing to supersede — no-op.
      if (layerDelta.length === 0 && supersedeLayerIds.length === 0) {
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Append-only layer insert (never rewrite another user's layer payload).
      const { data: latestVersionRows, error: latestVersionFetchError } = await versionsTable()
        .select("id, version_number")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .order("version_number", { ascending: false })
        .limit(1);

      if (latestVersionFetchError && !isMissingRelationError(latestVersionFetchError)) {
        throw latestVersionFetchError;
      }

      const persistedSupersedeIds = supersedeLayerIds.filter((id) =>
        isPersistedAnnotationLayerId(id)
      );

      let layerPersisted = false;
      const nextLayersPreview: AnnotationVersionEntry[] = annotationVersions
        .filter((v) => v.id !== LEGACY_JSON_LAYER_ID)
        .map((v) =>
          persistedSupersedeIds.includes(v.id) ? { ...v, is_enabled: false } : v
        );

      const stampedDelta = layerDelta.map((ann) =>
        ann.createdBy ? ann : { ...ann, createdBy: user.id }
      );

      const { data: attachment } = await supabase
        .from("attachments")
        .select("annotation_json")
        .eq("id", imageId)
        .maybeSingle();
      const previousJson = asAnnotationArray((attachment as any)?.annotation_json);

      if (!latestVersionFetchError) {
        const latest = latestVersionRows?.[0] as
          | { id: string; version_number: number }
          | undefined;
        const nextVersionNumber = (latest?.version_number ?? 0) + 1;
        const primarySupersede = persistedSupersedeIds[0] ?? null;

        const { data: inserted, error: insertError } = await versionsTable()
          .insert({
            org_id: orgId,
            task_id: taskId,
            image_id: imageId,
            created_by: user.id,
            version_number: nextVersionNumber,
            label: `Edit ${nextVersionNumber}`,
            annotations: stampedDelta,
            is_enabled: true,
            supersedes_id: primarySupersede,
          })
          .select("id, created_at")
          .maybeSingle();

        if (insertError) {
          console.error("Failed to insert annotation layer:", insertError);
          throw new Error(insertError.message || "Failed to save annotation layer");
        }
        layerPersisted = Boolean(inserted?.id);

        if (inserted?.id) {
          nextLayersPreview.push({
            id: inserted.id,
            created_at: inserted.created_at ?? new Date().toISOString(),
            created_by: user.id,
            version_number: nextVersionNumber,
            label: `Edit ${nextVersionNumber}`,
            annotations: stampedDelta,
            is_enabled: true,
          });
        }

        if (persistedSupersedeIds.length > 0) {
          const { error: disableError } = await versionsTable()
            .update({ is_enabled: false })
            .in("id", persistedSupersedeIds)
            .eq("task_id", taskId)
            .eq("image_id", imageId);
          if (disableError) {
            console.error("Failed to disable superseded layers:", disableError);
          }
        }
      }

      const idsInLayers = new Set(
        nextLayersPreview.flatMap((layer) => layer.annotations.map((ann) => ann.annotationId)),
      );
      const leftovers = previousJson.filter((ann) => !idsInLayers.has(ann.annotationId));
      const composite = layerPersisted
        ? [...leftovers, ...compositeAnnotations(nextLayersPreview)]
        : [...leftovers.filter((ann) => !stampedDelta.some((d) => d.annotationId === ann.annotationId)), ...stampedDelta];

      const { error: attachmentUpdateError } = await supabase
        .from("attachments")
        .update({
          annotation_json: composite as any,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", imageId);

      if (!layerPersisted) {
        // Table missing or insert failed — attachment JSON is the fallback store.
        if (attachmentUpdateError) {
          throw new Error(attachmentUpdateError.message || "Failed to persist annotations");
        }
        if (latestVersionFetchError && !isMissingRelationError(latestVersionFetchError)) {
          throw latestVersionFetchError;
        }
      }

      lastSavedRef.current = JSON.stringify(composite);
      await fetchAnnotations({ silent: true });
    },
    [orgId, taskId, imageId, annotationVersions, fetchAnnotations]
  );

  useEffect(() => {
    lastSavedRef.current = JSON.stringify(annotations);
  }, [annotations]);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [taskId, imageId]);

  useEffect(() => {
    void fetchAnnotations();
  }, [fetchAnnotations]);

  return {
    annotations,
    annotationVersions,
    sourceUpdatedAt,
    loading,
    error,
    saveAnnotations,
    refresh: fetchAnnotations,
  };
}
