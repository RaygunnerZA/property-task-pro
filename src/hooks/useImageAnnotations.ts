import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";
import { useRef } from "react";
import type { Annotation } from "@/types/image-annotations";

/**
 * Hook to fetch and manage image annotations for a task image.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for save operations.
 * 
 * @param taskId - The task ID
 * @param imageId - The image ID to fetch annotations for
 * @returns Annotations array, loading state, error state, refresh function, and save mutation
 */
export function useImageAnnotations(taskId: string, imageId: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();
  const lastSavedRef = useRef<string>("");

  // Query for fetching image annotations
  const { data: annotations = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.imageAnnotations(taskId, imageId),
    queryFn: async (): Promise<Annotation[]> => {
      if (!orgId || !taskId || !imageId) {
        return [];
      }

      const { data, error: fetchError } = await supabase
        .from("task_image_annotations")
        .select("*")
        .eq("task_id", taskId)
        .eq("image_id", imageId)
        .maybeSingle();

      // 404 is expected when no annotations exist yet - don't treat as error
      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.status === 404 || fetchError.message?.includes('404')) {
          return [];
        }
        throw fetchError;
      }

      if (!data) {
        return [];
      }

      // Get the latest version of each annotation (append-only log)
      const annotationMap = new Map<string, Annotation>();
      (data.annotations as Annotation[]).forEach((ann) => {
        const existing = annotationMap.get(ann.annotationId);
        if (!existing || ann.version > existing.version) {
          annotationMap.set(ann.annotationId, ann);
        }
      });

      const result = Array.from(annotationMap.values());
      // Update last saved reference
      lastSavedRef.current = JSON.stringify(result);
      return result;
    },
    enabled: !!orgId && !!taskId && !!imageId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes - annotations change moderately
    retry: 1,
  });

  // Mutation for saving annotations
  const saveAnnotationsMutation = useMutation({
    mutationFn: async (newAnnotations: Annotation[]) => {
      if (!orgId || !taskId || !imageId) {
        throw new Error("Missing required IDs");
      }

      // Check if annotations actually changed (diffing)
      const newJson = JSON.stringify(newAnnotations);
      if (newJson === lastSavedRef.current) {
        return; // No changes, skip save
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

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

        if (updateError) {
          throw updateError;
        }
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

        if (insertError) {
          throw insertError;
        }
      }

      // Update last saved reference
      lastSavedRef.current = newJson;
    },
    onSuccess: () => {
      // Invalidate and refetch annotations after save
      queryClient.invalidateQueries({ queryKey: queryKeys.imageAnnotations(taskId, imageId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation function
  const saveAnnotations = async (newAnnotations: Annotation[]) => {
    await saveAnnotationsMutation.mutateAsync(newAnnotations);
  };

  return {
    annotations,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    saveAnnotations,
    refresh,
  };
}
