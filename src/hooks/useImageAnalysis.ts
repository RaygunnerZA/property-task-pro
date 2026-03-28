/**
 * useImageAnalysis — AI image intake (router first, full on demand)
 * First pass: mode "router" (task | compliance | document | uncertain + labels).
 * Full extraction runs only when the user starts a compliance scan (never blocks task creation).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TempImage, ImageAnalysisResult } from "@/types/temp-image";

export interface UseImageAnalysisOptions {
  images: TempImage[];
  propertyId?: string;
  orgId: string;
  onAnalysisComplete?: (localId: string, result: ImageAnalysisResult) => void;
  onPatchImage?: (localId: string, patch: Partial<TempImage>) => void;
}

export interface UseImageAnalysisReturn {
  imageOcrText: string;
  detectedLabels: string[];
  status: "idle" | "loading" | "error";
  runFullIntakeAnalysis: (localId: string) => Promise<void>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function routerFallbackUncertain(): ImageAnalysisResult {
  return {
    ocr_text: "",
    detected_labels: [],
    detected_objects: [],
    metadata: {
      router_mode: true,
      workflow_hint: "uncertain",
      workflow_confidence: 0,
    },
  };
}

export function useImageAnalysis({
  images,
  propertyId,
  orgId,
  onAnalysisComplete,
  onPatchImage,
}: UseImageAnalysisOptions): UseImageAnalysisReturn {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const routerInProgressRef = useRef<Set<string>>(new Set());
  const fullInProgressRef = useRef<Set<string>>(new Set());
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const analyzeImageRouter = useCallback(
    async (img: TempImage) => {
      const readyForFastPass = img.thumbnail_blob && img.thumbnail_blob.type === "image/webp";
      if (!readyForFastPass || img.rawAnalysis || routerInProgressRef.current.has(img.local_id)) {
        return;
      }
      routerInProgressRef.current.add(img.local_id);
      setStatus((s) => (s === "idle" ? "loading" : s));

      try {
        const imageBase64 = await blobToBase64(img.thumbnail_blob);
        const { data, error } = await supabase.functions.invoke("ai-image-analyse", {
          body: {
            image: imageBase64,
            org_id: orgId,
            property_id: propertyId || null,
            mode: "router",
          },
        });

        if (error) {
          console.warn("[useImageAnalysis] Router error:", error);
          onAnalysisComplete?.(img.local_id, routerFallbackUncertain());
          return;
        }

        const result = (data as ImageAnalysisResult) || routerFallbackUncertain();
        onAnalysisComplete?.(img.local_id, result);
      } catch (err) {
        console.warn("[useImageAnalysis] Router failed:", err);
        onAnalysisComplete?.(img.local_id, routerFallbackUncertain());
      } finally {
        routerInProgressRef.current.delete(img.local_id);
        if (routerInProgressRef.current.size === 0 && fullInProgressRef.current.size === 0) {
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
        analyzeImageRouter(img);
      }
    }

    const pending = images.filter(
      (i) => i.thumbnail_blob && i.thumbnail_blob.type === "image/webp" && !i.rawAnalysis
    );
    if (pending.length === 0 && routerInProgressRef.current.size === 0 && fullInProgressRef.current.size === 0) {
      setStatus("idle");
    }
  }, [images, orgId, analyzeImageRouter]);

  const runFullIntakeAnalysis = useCallback(
    async (localId: string) => {
      const img = imagesRef.current.find((i) => i.local_id === localId);
      if (!img?.thumbnail_blob || img.thumbnail_blob.type !== "image/webp" || !orgId) return;

      const stage = (img.rawAnalysis?.metadata as Record<string, unknown> | undefined)?.intake_stage;
      if (stage === "full") return;
      if (fullInProgressRef.current.has(localId)) return;

      fullInProgressRef.current.add(localId);
      onPatchImage?.(localId, {
        intakeFullAnalysisPending: true,
        intakeUserPrefersTask: false,
      });
      setStatus((s) => (s === "idle" ? "loading" : s));

      try {
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
          console.warn("[useImageAnalysis] Full analysis error:", error);
          return;
        }

        const result = (data as ImageAnalysisResult) || {};
        const mergedMeta = {
          ...(result.metadata || {}),
          intake_stage: "full",
          router_mode: false,
        };
        onPatchImage?.(localId, {
          intakeFullAnalysisPending: false,
          rawAnalysis: { ...result, metadata: mergedMeta },
          aiOcrText: result.ocr_text ?? "",
          detectedLabels: result.detected_labels ?? [],
        });
      } catch (err) {
        console.warn("[useImageAnalysis] Full analysis failed:", err);
      } finally {
        fullInProgressRef.current.delete(localId);
        onPatchImage?.(localId, { intakeFullAnalysisPending: false });
        if (routerInProgressRef.current.size === 0 && fullInProgressRef.current.size === 0) {
          setStatus("idle");
        }
      }
    },
    [orgId, propertyId, onPatchImage]
  );

  const imageOcrText = useMemo(
    () =>
      images
        .map((i) => i.aiOcrText)
        .filter((s): s is string => Boolean(s))
        .join("\n"),
    [images]
  );

  const detectedLabels = useMemo(
    () => Array.from(new Set(images.flatMap((i) => i.detectedLabels || []))),
    [images]
  );

  return {
    imageOcrText,
    detectedLabels,
    status,
    runFullIntakeAnalysis,
  };
}
