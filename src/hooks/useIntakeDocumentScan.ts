/**
 * Immediate pre-save scan of non-image intake files (PDFs, office docs).
 * Uploads a short-lived scratch object, calls ai-doc-analyse without attachment_id
 * (suggestions only — no DB write), then deletes the scratch file.
 * AI output is untrusted: type/expiry/title are form hints the user can edit.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  mapIntakeDocumentType,
  normalizeIntakeExpiryDate,
  sanitizeScanTitle,
} from "@/lib/mapIntakeDocumentType";
import type { PendingIntakeFile } from "@/utils/ingestIntakeMediaFiles";

const MAX_CONCURRENT = 2;
const SKIP_EXTENSIONS = new Set(["zip", "7z", "rar", "gz", "tar", "exe", "dmg", "pkg"]);

export interface IntakeScanHints {
  title: string | null;
  documentType: string | null;
  expiryDate: string | null;
}

interface UseIntakeDocumentScanOptions {
  files: PendingIntakeFile[];
  onPatchFile: (localId: string, patch: Partial<PendingIntakeFile>) => void;
  orgId: string | null;
  propertyId?: string | null;
  enabled: boolean;
}

interface DocAnalysePayload {
  ok?: boolean;
  skipped?: boolean;
  error?: string;
  title?: string | null;
  document_type?: string | null;
  expiry_date?: string | null;
  ocr_text?: string | null;
}

function safeExtension(fileName: string): string {
  const ext = (fileName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext || ext.length > 8) return "bin";
  return ext;
}

function shouldSkipFile(file: PendingIntakeFile): boolean {
  const ext = safeExtension(file.display_name);
  if (SKIP_EXTENSIONS.has(ext)) return true;
  if (file.file_size <= 0) return true;
  const mime = (file.file_type || "").toLowerCase();
  if (mime.includes("zip") || mime.includes("executable")) return true;
  return false;
}

export function useIntakeDocumentScan({
  files,
  onPatchFile,
  orgId,
  propertyId,
  enabled,
}: UseIntakeDocumentScanOptions): {
  isScanning: boolean;
  waitUntilIdle: () => Promise<void>;
  getLatestHints: () => IntakeScanHints;
} {
  const [isScanning, setIsScanning] = useState(false);
  const inFlightRef = useRef(new Map<string, Promise<void>>());
  const latestRef = useRef(new Map<string, PendingIntakeFile>());
  const filesRef = useRef(files);
  filesRef.current = files;
  const onPatchFileRef = useRef(onPatchFile);
  onPatchFileRef.current = onPatchFile;

  const patch = useCallback((localId: string, next: Partial<PendingIntakeFile>) => {
    const current =
      latestRef.current.get(localId) ||
      filesRef.current.find((file) => file.local_id === localId);
    if (current) {
      latestRef.current.set(localId, { ...current, ...next });
    }
    onPatchFileRef.current(localId, next);
  }, []);

  const getLatestHints = useCallback((): IntakeScanHints => {
    const all = [...latestRef.current.values()];
    const withType = all.find((file) => file.scanDocumentType);
    const withExpiry = all.find((file) => file.scanExpiryDate);
    const withTitle = all.find((file) => file.scanTitle);
    return {
      title: withTitle?.scanTitle ?? null,
      documentType: withType?.scanDocumentType ?? withTitle?.scanDocumentType ?? null,
      expiryDate: withExpiry?.scanExpiryDate ?? null,
    };
  }, []);

  const waitUntilIdle = useCallback(async () => {
    while (inFlightRef.current.size > 0) {
      await Promise.allSettled([...inFlightRef.current.values()]);
    }
  }, []);

  const scanFile = useCallback(
    async (file: PendingIntakeFile) => {
      if (!orgId) return;
      if (shouldSkipFile(file)) {
        patch(file.local_id, { scanStatus: "skipped" });
        return;
      }

      patch(file.local_id, { scanStatus: "scanning" });
      const ext = safeExtension(file.display_name);
      const scratchPath = `org/${orgId}/intake-scratch/${crypto.randomUUID()}.${ext}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(scratchPath, file.file, { cacheControl: "60", upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(scratchPath);
        const { data, error } = await supabase.functions.invoke("ai-doc-analyse", {
          body: {
            file_url: urlData.publicUrl,
            file_name: file.display_name,
            org_id: orgId,
            property_id: propertyId || null,
          },
        });

        if (error) throw error;

        const payload = (data || {}) as DocAnalysePayload;
        if (payload.ok === false || payload.skipped || payload.error === "ai_allowance_exhausted") {
          patch(file.local_id, { scanStatus: "error" });
          return;
        }

        const mapped = mapIntakeDocumentType(payload.document_type);
        const next: Partial<PendingIntakeFile> = {
          scanStatus: "done",
          scanTitle: sanitizeScanTitle(payload.title),
          scanDocumentType: mapped?.type ?? null,
          scanExpiryDate: normalizeIntakeExpiryDate(payload.expiry_date),
          scanOcrText: payload.ocr_text ? payload.ocr_text.slice(0, 2000) : null,
        };
        patch(file.local_id, next);
      } catch (err) {
        console.warn("[useIntakeDocumentScan] scan failed:", err);
        patch(file.local_id, { scanStatus: "error" });
      } finally {
        void supabase.storage.from("task-images").remove([scratchPath]).then(
          () => undefined,
          () => undefined
        );
      }
    },
    [orgId, propertyId, patch]
  );

  useEffect(() => {
    if (!enabled || !orgId) {
      setIsScanning(false);
      return;
    }

    for (const file of files) {
      const prev = latestRef.current.get(file.local_id);
      latestRef.current.set(file.local_id, {
        ...file,
        scanStatus: file.scanStatus ?? prev?.scanStatus,
        scanTitle: file.scanTitle !== undefined ? file.scanTitle : prev?.scanTitle,
        scanDocumentType:
          file.scanDocumentType !== undefined ? file.scanDocumentType : prev?.scanDocumentType,
        scanExpiryDate: file.scanExpiryDate !== undefined ? file.scanExpiryDate : prev?.scanExpiryDate,
        scanOcrText: file.scanOcrText !== undefined ? file.scanOcrText : prev?.scanOcrText,
      });
    }

    const knownIds = new Set(files.map((file) => file.local_id));
    for (const id of [...latestRef.current.keys()]) {
      if (!knownIds.has(id)) latestRef.current.delete(id);
    }

    for (const file of files) {
      if (file.scanStatus) continue;
      if (inFlightRef.current.has(file.local_id)) continue;
      if (inFlightRef.current.size >= MAX_CONCURRENT) break;

      inFlightRef.current.set(file.local_id, Promise.resolve());
      const started = scanFile(file).finally(() => {
        inFlightRef.current.delete(file.local_id);
        if (inFlightRef.current.size === 0) setIsScanning(false);
      });
      inFlightRef.current.set(file.local_id, started);
      setIsScanning(true);
    }

    if (inFlightRef.current.size === 0) setIsScanning(false);
  }, [files, enabled, orgId, scanFile]);

  return {
    isScanning,
    waitUntilIdle,
    getLatestHints,
  };
}
