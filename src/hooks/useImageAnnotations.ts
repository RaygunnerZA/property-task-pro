import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { debounce } from "@/lib/debounce";
import type { Annotation, TaskImageAnnotationRecord } from "@/types/image-annotations";

export function useImageAnnotations(taskId: string, imageId: string) {
  const { orgId } = useActiveOrg();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMissingRelationError = (err: any) => {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("does not exist") || msg.includes("relation") || err?.code === "42P01";
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
      // Prefer latest task_image_annotations row (handles duplicate legacy rows gracefully).
      const { data: rows, error: fetchError } = await supabase
        .from("task_image_annotations")
        .select("id, annotations, updated_at, created_at")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchError && !isMissingRelationError(fetchError)) throw fetchError;

      const latest = rows?.[0] as { annotations?: Annotation[] } | undefined;
      if (latest?.annotations) {
        // Get the latest version of each annotation (append-only log)
        const annotationMap = new Map<string, Annotation>();
        (latest.annotations as Annotation[]).forEach((ann) => {
          const existing = annotationMap.get(ann.annotationId);
          if (!existing || ann.version > existing.version) {
            annotationMap.set(ann.annotationId, ann);
          }
        });
        setAnnotations(Array.from(annotationMap.values()));
      } else if (!fetchError) {
        setAnnotations([]);
      } else {
        // Fallback: annotation_json on attachments (for environments where
        // task_image_annotations is missing/unavailable).
        const { data: attachment } = await supabase
          .from("attachments")
          .select("annotation_json")
          .eq("id", imageId)
          .maybeSingle();
        const fallbackAnnotations = (attachment as any)?.annotation_json as Annotation[] | undefined;
        setAnnotations(Array.isArray(fallbackAnnotations) ? fallbackAnnotations : []);
      }
    } catch (err: any) {
      // 404 is expected when no annotations exist yet - don't treat as error
      if (err.code === 'PGRST116' || err.status === 404 || err.message?.includes('404')) {
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

      // 2) Secondary persistence: task_image_annotations row (if table exists).
      const { data: existingRows, error: existingFetchError } = await supabase
        .from("task_image_annotations")
        .select("id")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (!existingFetchError) {
        const existing = existingRows?.[0] as { id: string } | undefined;
        if (existing) {
          const { error: updateError } = await supabase
            .from("task_image_annotations")
            .update({
              annotations: nextAnnotations,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (!updateError) persisted = true;
        } else {
          const { error: insertError } = await supabase
            .from("task_image_annotations")
            .insert({
              task_id: taskId,
              image_id: imageId,
              created_by: user.id,
              annotations: nextAnnotations,
            });
          if (!insertError) persisted = true;
        }
      } else if (!isMissingRelationError(existingFetchError)) {
        throw existingFetchError;
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
    loading,
    error,
    saveAnnotations,
    refresh: fetchAnnotations,
  };
}
