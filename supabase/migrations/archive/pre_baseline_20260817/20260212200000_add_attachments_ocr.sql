-- Add ocr_text and metadata to attachments for AI results (Phase 2)

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS ocr_text TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN attachments.ocr_text IS 'AI-extracted OCR text from image analysis';
COMMENT ON COLUMN attachments.metadata IS 'Flexible AI metadata: detected_objects, document_classification, etc.';
