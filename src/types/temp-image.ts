import type { Annotation } from "@/types/image-annotations";

export type UploadStatus = "pending" | "uploading" | "uploaded" | "failed";

export interface TempImage {
  local_id: string;              // uuid() - client-side identifier
  display_name: string;
  original_file: File;
  thumbnail_blob: Blob;          // 200x200px compressed WebP
  optimized_blob: Blob;          // ≤1200px longest side, WebP
  annotation_json?: Annotation[]; // Saved before task exists
  uploaded: boolean;             // false until after task creation
  upload_status?: UploadStatus;
  storage_paths?: {
    thumbnail?: string;
    optimized?: string;
  };
  // For display purposes
  thumbnail_url?: string;        // Blob URL for instant display
  optimized_url?: string;         // Blob URL for full view
  // Error state
  upload_error?: string;
}

export interface OptimizedImageResult {
  thumbnail: Blob;
  optimized: Blob;
}
