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

  const fetchAnnotations = useCallback(async () => {
    if (!orgId || !taskId || !imageId) {
      setAnnotations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("task_image_annotations")
        .select("*")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        // Get the latest version of each annotation (append-only log)
        const annotationMap = new Map<string, Annotation>();
        (data.annotations as Annotation[]).forEach((ann) => {
          const existing = annotationMap.get(ann.annotationId);
          if (!existing || ann.version > existing.version) {
            annotationMap.set(ann.annotationId, ann);
          }
        });
        setAnnotations(Array.from(annotationMap.values()));
      } else {
        setAnnotations([]);
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

      // Fetch existing record
      const { data: existing } = await supabase
        .from("task_image_annotations")
        .select("*")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .maybeSingle();

      // Append-only: merge with existing annotations
      const existingAnnotations = existing?.annotations || [];
      const mergedAnnotations = [...(existingAnnotations as Annotation[]), ...newAnnotations];

      if (existing) {
        // Update existing record (append-only)
        const { error: updateError } = await supabase
          .from("task_image_annotations")
          .update({
            annotations: mergedAnnotations,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from("task_image_annotations")
          .insert({
            task_id: taskId,
            image_id: imageId,
            created_by: user.id,
            annotations: mergedAnnotations,
          });

        if (insertError) throw insertError;
      }

      // Update last saved reference
      lastSavedRef.current = newJson;
      await fetchAnnotations();
    },
    [orgId, taskId, imageId, fetchAnnotations]
  );

  // Update lastSavedRef when annotations are fetched
  useEffect(() => {
    if (annotations.length > 0) {
      lastSavedRef.current = JSON.stringify(annotations);
    }
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
