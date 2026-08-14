import type { DragEvent } from "react";
import type { TempImage } from "@/types/temp-image";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";

export interface PendingIntakeFile {
  local_id: string;
  file: File;
  display_name: string;
  file_size: number;
  file_type: string;
}

export const INTAKE_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** Pull image files from a clipboard paste event (screenshots, copied photos). */
export function clipboardImageFiles(
  clipboardData: DataTransfer | null | undefined
): File[] {
  if (!clipboardData) return [];
  const out: File[] = [];
  const items = clipboardData.items;
  if (items) {
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      out.push(nameClipboardImage(blob, item.type));
    }
  }
  if (out.length === 0 && clipboardData.files?.length) {
    for (const file of Array.from(clipboardData.files)) {
      if (file.type.startsWith("image/")) out.push(nameClipboardImage(file, file.type));
    }
  }
  return out;
}

function nameClipboardImage(file: File, mimeType: string): File {
  const hasRealName =
    Boolean(file.name) &&
    file.name !== "image.png" &&
    file.name !== "image.jpg" &&
    !/^blob/i.test(file.name);
  if (hasRealName) return file;
  const subtype = (mimeType.split("/")[1] || "png").split(";")[0] || "png";
  const ext = subtype === "jpeg" ? "jpg" : subtype;
  return new File([file], `pasted-${Date.now()}.${ext}`, {
    type: file.type || mimeType || "image/png",
    lastModified: Date.now(),
  });
}

/** True when a drag payload includes files (needed to allow drop). */
export function dataTransferHasFiles(data: DataTransfer | null | undefined): boolean {
  if (!data) return false;
  if (data.files && data.files.length > 0) return true;
  return Array.from(data.types ?? []).some((t) => t === "Files" || t === "application/x-moz-file");
}

/** Files from a drop (images and other attachments). */
export function dataTransferFiles(data: DataTransfer | null | undefined): File[] {
  if (!data?.files?.length) return [];
  return Array.from(data.files);
}

type FileDropBind = {
  onDragEnter: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

/**
 * Silent drop target — no visual chrome. Callers must not change layout/styling.
 */
export function fileDropBind(onFiles: (files: File[]) => void): FileDropBind {
  const allow = (event: DragEvent) => {
    if (!dataTransferHasFiles(event.dataTransfer)) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  return {
    onDragEnter: (event) => {
      allow(event);
    },
    onDragOver: (event) => {
      if (!allow(event)) return;
      event.dataTransfer.dropEffect = "copy";
    },
    onDrop: (event) => {
      if (!allow(event)) return;
      const files = dataTransferFiles(event.dataTransfer);
      if (files.length) onFiles(files);
    },
  };
}

type IngestArgs = {
  incomingFiles: File[] | FileList | null | undefined;
  images: TempImage[];
  files: PendingIntakeFile[];
  onImagesChange: (images: TempImage[]) => void;
  onFilesChange: (files: PendingIntakeFile[]) => void;
  maxFileSize?: number;
  /** Called with count of files skipped for size. */
  onOversized?: (count: number) => void;
};

/**
 * Same path as Add Photo / file picker: provisional preview, then optimize.
 * Non-images go into the pending files list.
 */
export async function ingestIntakeMediaFiles({
  incomingFiles,
  images,
  files,
  onImagesChange,
  onFilesChange,
  maxFileSize = INTAKE_MAX_FILE_SIZE,
  onOversized,
}: IngestArgs): Promise<void> {
  if (!incomingFiles) return;
  const list = Array.isArray(incomingFiles)
    ? incomingFiles
    : Array.from(incomingFiles);
  if (list.length === 0) return;

  const nextImages = [...images];
  const newFiles: PendingIntakeFile[] = [];
  const imageJobs: Promise<void>[] = [];
  let oversizedCount = 0;
  const commitImages = () => onImagesChange([...nextImages]);

  for (const file of list) {
    if (file.size > maxFileSize) {
      oversizedCount += 1;
      continue;
    }

    if (!file.type.startsWith("image/")) {
      newFiles.push({
        local_id: crypto.randomUUID(),
        file,
        display_name: file.name,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
      });
      continue;
    }

    const localId = crypto.randomUUID();
    const provisionalUrl = URL.createObjectURL(file);
    const provisionalImage: TempImage = {
      local_id: localId,
      display_name: file.name,
      original_file: file,
      thumbnail_blob: file,
      optimized_blob: file,
      annotation_json: [],
      uploaded: false,
      upload_status: "pending",
      thumbnail_url: provisionalUrl,
      optimized_url: provisionalUrl,
    };
    nextImages.push(provisionalImage);
    commitImages();

    const job = createTempImage(file)
      .then((tempImage) => {
        const idx = nextImages.findIndex((img) => img.local_id === localId);
        if (idx === -1) {
          cleanupTempImage(tempImage);
          return;
        }
        const existing = nextImages[idx];
        if (existing.thumbnail_url === existing.optimized_url && existing.thumbnail_url) {
          URL.revokeObjectURL(existing.thumbnail_url);
        } else {
          if (existing.thumbnail_url) URL.revokeObjectURL(existing.thumbnail_url);
          if (existing.optimized_url) URL.revokeObjectURL(existing.optimized_url);
        }
        nextImages[idx] = {
          ...tempImage,
          local_id: localId,
          display_name: existing.display_name,
          original_file: existing.original_file,
          annotation_json: existing.annotation_json ?? [],
          uploaded: existing.uploaded,
          upload_status: existing.upload_status ?? "pending",
        };
        commitImages();
      })
      .catch((error) => {
        console.error(`Failed to process "${file.name}":`, error);
        const idx = nextImages.findIndex((img) => img.local_id === localId);
        if (idx !== -1) {
          const failed = nextImages[idx];
          nextImages[idx] = {
            ...failed,
            upload_status: "failed",
            upload_error: "Image processing failed",
          };
          commitImages();
        }
      });
    imageJobs.push(job);
  }

  if (imageJobs.length > 0) {
    await Promise.allSettled(imageJobs);
  }

  if (oversizedCount > 0) {
    onOversized?.(oversizedCount);
  }

  if (newFiles.length > 0) {
    onFilesChange([...files, ...newFiles]);
  }
}
