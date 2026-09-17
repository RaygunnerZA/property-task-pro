import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractOfficePlainText, isOfficeDocument } from "@/lib/officeDocumentText";
import {
  blobForInboxFile,
  canExtractTextLocally,
  intakeFileKind,
  intakePreviewKind,
  normalizeInboxContentType,
  type IntakePreviewKind,
} from "@/lib/intakeFileKind";
import { extractPdfEmbeddedImage, extractPdfPlainText } from "@/lib/pdfDocumentText";
import { inspectPdf } from "@/lib/renderPdfPageThumbnail";

const MAX_PARSE_BYTES = 12 * 1024 * 1024;
const MAX_OFFICE_BYTES = 8 * 1024 * 1024;

export interface InboxFilePreview {
  kind: IntakePreviewKind;
  openUrl: string | null;
  thumbnailUrl: string | null;
  extractedText: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: InboxFilePreview = {
  kind: "none",
  openUrl: null,
  thumbnailUrl: null,
  extractedText: null,
  loading: false,
  error: null,
};

/**
 * Load a private inbox object for review: openable URL, thumbnail, and local text.
 * Uses the user JWT + storage RLS. Does not take a client-supplied bucket name.
 */
export function useInboxFilePreview(options: {
  storagePath: string | null | undefined;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  enabled: boolean;
}): InboxFilePreview {
  const { storagePath, mimeType, fileName, fileSize, enabled } = options;
  const kind = intakePreviewKind(mimeType, fileName);
  const [state, setState] = useState<InboxFilePreview>({ ...EMPTY, kind, loading: Boolean(enabled && storagePath) });

  useEffect(() => {
    if (!enabled || !storagePath) {
      setState({ ...EMPTY, kind });
      return;
    }

    let cancelled = false;
    const objectUrls: string[] = [];
    const contentType = normalizeInboxContentType(mimeType, fileName);
    const fileKind = intakeFileKind(mimeType, fileName);

    setState({
      kind,
      openUrl: null,
      thumbnailUrl: null,
      extractedText: null,
      loading: true,
      error: null,
    });

    void (async () => {
      try {
        const { data: signed, error: signError } = await supabase.storage
          .from("inbox")
          .createSignedUrl(storagePath, 3600);

        if (cancelled) return;
        const signedUrl = !signError && signed?.signedUrl ? signed.signedUrl : null;

        const shouldDownload =
          fileKind === "pdf" ||
          (fileKind === "office" && (fileSize == null || fileSize <= MAX_OFFICE_BYTES)) ||
          (fileKind === "text" && (fileSize == null || fileSize <= MAX_OFFICE_BYTES)) ||
          (fileKind === "image" && !signedUrl);

        let blob: Blob | null = null;
        let bytes: Uint8Array | null = null;

        if (shouldDownload && (fileSize == null || fileSize <= MAX_PARSE_BYTES)) {
          const { data, error } = await supabase.storage.from("inbox").download(storagePath);
          if (cancelled) return;
          if (!error && data) {
            blob = blobForInboxFile(data, contentType, fileName);
            bytes = new Uint8Array(await data.arrayBuffer());
          }
        }

        if (cancelled) return;

        let openUrl = signedUrl;
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          openUrl = objectUrl;
        }
        if (cancelled) {
          for (const url of objectUrls) URL.revokeObjectURL(url);
          return;
        }

        let thumbnailUrl: string | null = kind === "image" ? openUrl : null;
        let extractedText: string | null = null;
        const bytesCopy = bytes ? bytes.slice() : null;

        if (bytesCopy && fileKind === "pdf") {
          if (canExtractTextLocally(contentType, fileName)) {
            const pdfText = await extractPdfPlainText(bytesCopy);
            if (pdfText.trim().length >= 12) extractedText = pdfText;
          }
          const embedded = extractPdfEmbeddedImage(bytesCopy);
          if (embedded) {
            const embeddedUrl = URL.createObjectURL(embedded);
            objectUrls.push(embeddedUrl);
            thumbnailUrl = embeddedUrl;
          }
          if (!thumbnailUrl || !extractedText) {
            const inspected = await inspectPdf(bytesCopy.slice().buffer as ArrayBuffer);
            if (cancelled) {
              for (const url of objectUrls) URL.revokeObjectURL(url);
              return;
            }
            if (!thumbnailUrl && inspected.thumbnailUrl) thumbnailUrl = inspected.thumbnailUrl;
            if (!extractedText && inspected.text.trim().length >= 12) extractedText = inspected.text;
          }
        } else if (bytesCopy && fileKind === "office") {
          if (isOfficeDocument(contentType, fileName)) {
            const officeText = await extractOfficePlainText(bytesCopy.slice().buffer as ArrayBuffer, fileName);
            if (officeText.trim().length >= 12) extractedText = officeText;
          }
        } else if (bytesCopy && fileKind === "text") {
          const text = new TextDecoder().decode(bytesCopy).trim();
          if (text.length >= 12) extractedText = text.slice(0, 8000);
        }

        if (cancelled) {
          for (const url of objectUrls) URL.revokeObjectURL(url);
          return;
        }
        setState({
          kind,
          openUrl,
          thumbnailUrl,
          extractedText,
          loading: false,
          error: openUrl ? null : "Could not open this file",
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          kind,
          openUrl: null,
          thumbnailUrl: null,
          extractedText: null,
          loading: false,
          error: error instanceof Error ? error.message : "Could not open this file",
        });
      }
    })();

    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [enabled, storagePath, mimeType, fileName, fileSize, kind]);

  return state;
}
