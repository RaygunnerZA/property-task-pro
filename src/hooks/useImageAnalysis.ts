/**
 * useImageAnalysis — Lightweight orchestrator for AI image analysis (Phase 1)
 * Watches TempImage[] and sends each image's thumbnail_blob to ai-image-analyse edge function.
 * Fire-and-forget: never blocks task creation.
 *
 * Phase 3 merge rule: Results here are for chip suggestions ONLY.
 * Never written to attachments. Phase 2 post-upload analysis is the source of truth.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TempImage, ImageAnalysisResult } from "@/types/temp-image";

export interface UseImageAnalysisOptions {
  images: TempImage[];
  propertyId?: string;
  orgId: string;
  onAnalysisComplete?: (localId: string, result: ImageAnalysisResult) => void;
}

export interface UseImageAnalysisReturn {
  imageOcrText: string;
  detectedLabels: string[];
  status: "idle" | "loading" | "error";
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip data URL prefix if present
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useImageAnalysis({
  images,
  propertyId,
  orgId,
  onAnalysisComplete,
}: UseImageAnalysisOptions): UseImageAnalysisReturn {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const inProgressRef = useRef<Set<string>>(new Set());

  const analyzeImage = useCallback(
    async (img: TempImage) => {
      const readyForFastPass = img.thumbnail_blob && img.thumbnail_blob.type === "image/webp";
      if (!readyForFastPass || img.rawAnalysis || inProgressRef.current.has(img.local_id)) {
        return;
      }
      inProgressRef.current.add(img.local_id);
      setStatus((s) => (s === "idle" ? "loading" : s));

      try {
        // Fast first-pass: use low-res thumbnail blob for near-instant routing hints.
        const imageBase64 = await blobToBase64(img.thumbnail_blob);
        const { data, error } = await supabase.functions.invoke("ai-image-analyse", {
          body: {
            image: imageBase64,
            org_id: orgId,
            property_id: propertyId || null,
            mode: "full",
          },
        });

        if (error) {
          console.warn("[useImageAnalysis] Edge function error:", error);
          return;
        }

        const result = (data as ImageAnalysisResult) || {};
        onAnalysisComplete?.(img.local_id, result);
      } catch (err) {
        console.warn("[useImageAnalysis] Analysis failed:", err);
      } finally {
        inProgressRef.current.delete(img.local_id);
        if (inProgressRef.current.size === 0) {
          setStatus("idle");
        }
      }
    },
    [orgId, propertyId, onAnalysisComplete]
  );

  useEffect(() => {
    if (!orgId || images.length === 0) {
      setStatus("idle");
      return;
    }

    for (const img of images) {
      if (img.thumbnail_blob && img.thumbnail_blob.type === "image/webp" && !img.rawAnalysis) {
        analyzeImage(img);
      }
    }

    // If all images already have results, ensure status is idle
    const pending = images.filter(
      (i) => i.thumbnail_blob && i.thumbnail_blob.type === "image/webp" && !i.rawAnalysis
    );
    if (pending.length === 0 && inProgressRef.current.size === 0) {
      setStatus("idle");
    }
  }, [images, orgId, analyzeImage]);

  // Aggregate results from images (memoize to avoid infinite loop in useChipSuggestions)
  const imageOcrText = useMemo(
    () =>
      images
        .map((i) => i.aiOcrText)
        .filter((s): s is string => Boolean(s))
        .join("\n"),
    [images]
  );

  const detectedLabels = useMemo(
    () =>
      Array.from(new Set(images.flatMap((i) => i.detectedLabels || []))),
    [images]
  );

  return {
    imageOcrText,
    detectedLabels,
    status,
  };
}
