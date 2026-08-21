/**
 * useImageAnalysis — AI image intake (router first, full on demand)
 * First pass: mode "router" (task | compliance | document | uncertain + labels).
 * Full extraction runs only when the user starts a compliance scan (never blocks task creation),
 * unless preferFullAnalysis is set (Add Record — scan immediately).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TempImage, ImageAnalysisResult } from "@/types/temp-image";
import { hintsFromImageAnalysis } from "@/lib/mapIntakeDocumentType";

export interface ImageScanHints {
  documentType: string | null;
  expiryDate: string | null;
}

export interface UseImageAnalysisOptions {
  images: TempImage[];
  propertyId?: string;
  orgId: string;
  onAnalysisComplete?: (localId: string, result: ImageAnalysisResult) => void;
  onPatchImage?: (localId: string, patch: Partial<TempImage>) => void;
  /** Skip the router pass and run full extraction as soon as the readable image is ready. */
  preferFullAnalysis?: boolean;
}

export interface UseImageAnalysisReturn {
  imageOcrText: string;
  detectedLabels: string[];
  status: "idle" | "loading" | "error";
  runFullIntakeAnalysis: (localId: string) => Promise<void>;
  waitUntilIdle: () => Promise<void>;
  getLatestFullHints: () => ImageScanHints;
}

function analysisSourceBlob(img: TempImage, preferOptimized: boolean): Blob | null {
  if (preferOptimized && img.optimized_blob?.type === "image/webp") return img.optimized_blob;
  if (img.optimized_blob?.type === "image/webp") return img.optimized_blob;
  if (img.thumbnail_blob?.type === "image/webp") return img.thumbnail_blob;
  return null;
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

function hintsFromAnalysis(result: ImageAnalysisResult | undefined): ImageScanHints {
  return hintsFromImageAnalysis(result);
}

export function useImageAnalysis({
  images,
  propertyId,
  orgId,
  onAnalysisComplete,
  onPatchImage,
  preferFullAnalysis = false,
}: UseImageAnalysisOptions): UseImageAnalysisReturn {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const routerInProgressRef = useRef<Set<string>>(new Set());
  const fullInProgressRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(new Map<string, Promise<void>>());
  const hintsRef = useRef<ImageScanHints>({ documentType: null, expiryDate: null });
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const rememberHints = useCallback((result: ImageAnalysisResult | undefined) => {
    const next = hintsFromAnalysis(result);
    if (next.documentType || next.expiryDate) {
      hintsRef.current = {
        documentType: next.documentType || hintsRef.current.documentType,
        expiryDate: next.expiryDate || hintsRef.current.expiryDate,
      };
    }
  }, []);

  const waitUntilIdle = useCallback(async () => {
    while (inFlightRef.current.size > 0) {
      await Promise.allSettled([...inFlightRef.current.values()]);
    }
  }, []);

  const getLatestFullHints = useCallback((): ImageScanHints => hintsRef.current, []);

  const analyzeImageRouter = useCallback(
    async (img: TempImage) => {
      const readyForFastPass = analysisSourceBlob(img, false);
      if (!readyForFastPass || img.rawAnalysis || routerInProgressRef.current.has(img.local_id)) {
        return;
      }
      const flightKey = `router:${img.local_id}`;
      if (inFlightRef.current.has(flightKey)) return;
      routerInProgressRef.current.add(img.local_id);
      const job = (async () => {
      setStatus((s) => (s === "idle" ? "loading" : s));

      try {
        const imageBase64 = await blobToBase64(readyForFastPass);
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
      })();
      inFlightRef.current.set(flightKey, job);
      try {
        await job;
      } finally {
        inFlightRef.current.delete(flightKey);
      }
    },
    [orgId, propertyId, onAnalysisComplete]
  );

  const runFullIntakeAnalysis = useCallback(
    async (localId: string) => {
      const img = imagesRef.current.find((i) => i.local_id === localId);
      const source = img ? analysisSourceBlob(img, true) : null;
      if (!img || !source || !orgId) return;

      const stage = (img.rawAnalysis?.metadata as Record<string, unknown> | undefined)?.intake_stage;
      if (stage === "full") return;
      const flightKey = `full:${localId}`;
      if (fullInProgressRef.current.has(localId) || inFlightRef.current.has(flightKey)) return;

      fullInProgressRef.current.add(localId);
      const job = (async () => {
      onPatchImage?.(localId, {
        intakeFullAnalysisPending: true,
        intakeUserPrefersTask: false,
      });
      setStatus((s) => (s === "idle" ? "loading" : s));

      try {
        const imageBase64 = await blobToBase64(source);
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
          onPatchImage?.(localId, {
            intakeFullAnalysisPending: false,
            rawAnalysis: {
              ...(img.rawAnalysis || {}),
              metadata: {
                ...(img.rawAnalysis?.metadata || {}),
                intake_stage: "full",
                full_analysis_failed: true,
              },
            },
          });
          return;
        }

        const result = (data as ImageAnalysisResult) || {};
        const mergedMeta = {
          ...(result.metadata || {}),
          intake_stage: "full",
          router_mode: false,
          document_classification:
            (result.metadata?.document_classification as ImageAnalysisResult["document_classification"]) ||
            result.document_classification,
          normalized_expiry:
            (typeof result.metadata?.normalized_expiry === "string"
              ? result.metadata.normalized_expiry
              : null) ||
            result.document_classification?.expiry_date ||
            null,
          normalized_document_type:
            (typeof result.metadata?.normalized_document_type === "string"
              ? result.metadata.normalized_document_type
              : null) ||
            result.document_classification?.type ||
            null,
        };
        rememberHints({ ...result, metadata: mergedMeta });
        onPatchImage?.(localId, {
          intakeFullAnalysisPending: false,
          rawAnalysis: { ...result, metadata: mergedMeta },
          aiOcrText: result.ocr_text ?? "",
          detectedLabels: result.detected_labels ?? [],
        });
      } catch (err) {
        console.warn("[useImageAnalysis] Full analysis failed:", err);
        onPatchImage?.(localId, {
          intakeFullAnalysisPending: false,
          rawAnalysis: {
            ...(img.rawAnalysis || {}),
            metadata: {
              ...(img.rawAnalysis?.metadata || {}),
              intake_stage: "full",
              full_analysis_failed: true,
            },
          },
        });
      } finally {
        fullInProgressRef.current.delete(localId);
        onPatchImage?.(localId, { intakeFullAnalysisPending: false });
        if (routerInProgressRef.current.size === 0 && fullInProgressRef.current.size === 0) {
          setStatus("idle");
        }
      }
      })();
      inFlightRef.current.set(flightKey, job);
      try {
        await job;
      } finally {
        inFlightRef.current.delete(flightKey);
      }
    },
    [orgId, propertyId, onPatchImage, rememberHints]
  );

  useEffect(() => {
    if (!orgId || images.length === 0) {
      setStatus("idle");
      return;
    }

    for (const img of images) {
      const ready = Boolean(analysisSourceBlob(img, preferFullAnalysis));
      if (!ready) continue;
      const stage = (img.rawAnalysis?.metadata as Record<string, unknown> | undefined)?.intake_stage;

      if (preferFullAnalysis) {
        if (stage !== "full") {
          void runFullIntakeAnalysis(img.local_id);
        }
        continue;
      }

      if (!img.rawAnalysis) {
        void analyzeImageRouter(img);
      }
    }

    const pending = images.filter(
      (i) => i.thumbnail_blob && i.thumbnail_blob.type === "image/webp" && !i.rawAnalysis
    );
    if (pending.length === 0 && routerInProgressRef.current.size === 0 && fullInProgressRef.current.size === 0) {
      setStatus("idle");
    }
  }, [images, orgId, preferFullAnalysis, analyzeImageRouter, runFullIntakeAnalysis]);

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
    waitUntilIdle,
    getLatestFullHints,
  };
}
