export type IntakeSourceType = "upload" | "forwarded_email" | "calendar_event" | "cloud_file";

export type IntakeItemStatus =
  | "pending"
  | "processing"
  | "ready"
  | "confirmed"
  | "ignored"
  | "failed";

export interface IntakeItem {
  id: string;
  org_id: string;
  property_id: string | null;
  created_by: string;
  source_type: IntakeSourceType;
  status: IntakeItemStatus;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  ai_classification: string | null;
  ai_extracted: Record<string, unknown> | null;
  ai_confidence: number | null;
  error_message: string | null;
  raw_text: string | null;
  created_at: string;
  processed_at: string | null;
}

/** Passed into IntakeModal when reviewing a processed intake item. */
export interface IntakeSourceArtifact {
  intakeItemId: string;
  storagePath: string | null;
  fileName: string | null;
  mimeType: string;
  rawText?: string | null;
  sourceType?: IntakeSourceType;
  aiClassification?: string | null;
  aiExtracted?: Record<string, unknown> | null;
}
