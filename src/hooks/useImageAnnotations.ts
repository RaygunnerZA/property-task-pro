import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Annotation } from "@/types/image-annotations";

export interface AnnotationVersionEntry {
  id: string;
  created_at: string;
  created_by: string | null;
  version_number: number;
  label: string;
  annotations: Annotation[];
}

export function useImageAnnotations(taskId: string, imageId: string) {
  const { orgId } = useActiveOrg();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationVersions, setAnnotationVersions] = useState<AnnotationVersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMissingRelationError = (err: any) => {
    const msg = String(err?.message || "").toLowerCase();
    return (
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("could not find the table") ||
      err?.code === "42P01" ||
      err?.code === "PGRST205"
    );
  };

  const fetchAnnotations = useCallback(async () => {
    if (!orgId || !taskId || !imageId) {
      setAnnotations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Primary source: version history table.
      const { data: versionRows, error: versionsError } = await supabase
        .from("task_image_annotation_versions")
        .select("id, annotations, created_at, created_by, version_number, label")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .order("version_number", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (versionsError && !isMissingRelationError(versionsError)) throw versionsError;

      if (!versionsError && Array.isArray(versionRows) && versionRows.length > 0) {
        const mappedVersions: AnnotationVersionEntry[] = (versionRows as any[]).map((row) => ({
          id: row.id,
          created_at: row.created_at,
          created_by: row.created_by,
          version_number: row.version_number,
          label: row.label,
          annotations: Array.isArray(row.annotations) ? (row.annotations as Annotation[]) : [],
        }));
        setAnnotationVersions(mappedVersions);
        setAnnotations(mappedVersions[0]?.annotations ?? []);
      } else {
        // Fallback: attachment annotation JSON when version rows are missing/unavailable.
        const { data: attachment } = await supabase
          .from("attachments")
          .select("annotation_json")
          .eq("id", imageId)
          .maybeSingle();
        const fallbackAnnotations = (attachment as any)?.annotation_json as Annotation[] | undefined;
        setAnnotationVersions([]);
        setAnnotations(Array.isArray(fallbackAnnotations) ? fallbackAnnotations : []);
      }
    } catch (err: any) {
      // 404 is expected when no annotations exist yet - don't treat as error
      if (err.code === 'PGRST116' || err.status === 404 || err.message?.includes('404')) {
        setAnnotationVersions([]);
        setAnnotations([]);
        setError(null);
      } else {
        console.error("Error fetching annotations:", err);
        setError(err.message || "Failed to fetch annotations");
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, taskId, imageId]);

  const lastSavedRef = useRef<string>("");
  
  const saveAnnotations = useCallback(
    async (newAnnotations: Annotation[]) => {
      if (!orgId || !taskId || !imageId) {
        throw new Error("Missing required IDs");
      }

      // Check if annotations actually changed (diffing)
      const newJson = JSON.stringify(newAnnotations);
      if (newJson === lastSavedRef.current) {
        return; // No changes, skip save
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Store latest annotations (editor sends full state)
      const nextAnnotations = newAnnotations;
      let persisted = false;

      // 1) Primary persistence: attachment row JSON (best-effort, non-fatal).
      const { error: attachmentUpdateError } = await supabase
        .from("attachments")
        .update({
          annotation_json: nextAnnotations as any,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", imageId);
      if (!attachmentUpdateError) {
        persisted = true;
      }

      // 2) Collaborative layers: same user edits same layer; new user gets a new layer.
      const { data: latestVersionRows, error: latestVersionFetchError } = await supabase
        .from("task_image_annotation_versions")
        .select("id, version_number, created_by")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .order("version_number", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (!latestVersionFetchError && latestVersionRows && latestVersionRows.length > 0) {
        const latest = latestVersionRows[0] as { id: string; version_number: number; created_by: string | null };
        const isSameUser = latest.created_by === user.id;
        if (isSameUser) {
          const { error: updateError } = await supabase
            .from("task_image_annotation_versions")
            .update({ annotations: nextAnnotations as any })
            .eq("id", latest.id);
          if (!updateError) persisted = true;
        } else {
          const nextVersionNumber = (latest.version_number ?? 0) + 1;
          const label = `Layer ${nextVersionNumber}`;
          const { error: insertError } = await supabase
            .from("task_image_annotation_versions")
            .insert({
              task_id: taskId,
              image_id: imageId,
              created_by: user.id,
              version_number: nextVersionNumber,
              label,
              annotations: nextAnnotations as any,
            });
          if (!insertError) persisted = true;
        }
      } else if (!latestVersionFetchError) {
        const label = "Layer 1";
        const { error: insertError } = await supabase
          .from("task_image_annotation_versions")
          .insert({
            task_id: taskId,
            image_id: imageId,
            created_by: user.id,
            version_number: 1,
            label,
            annotations: nextAnnotations as any,
          });
        if (!insertError) persisted = true;
      } else if (!isMissingRelationError(latestVersionFetchError)) {
        throw latestVersionFetchError;
      }

      if (!persisted) {
        throw new Error("Failed to persist annotations");
      }

      // Update last saved reference
      lastSavedRef.current = newJson;
      await fetchAnnotations();
    },
    [orgId, taskId, imageId, fetchAnnotations]
  );

  // Update lastSavedRef when annotations are fetched
  useEffect(() => {
    lastSavedRef.current = JSON.stringify(annotations);
  }, [annotations]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  return {
    annotations,
    annotationVersions,
    loading,
    error,
    saveAnnotations,
    refresh: fetchAnnotations,
  };
}
