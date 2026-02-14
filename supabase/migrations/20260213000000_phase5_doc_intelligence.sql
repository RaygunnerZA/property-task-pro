-- Phase 5: Property Document Intelligence
-- Add ai_confidence, ensure idx_attachments_parent

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC;

COMMENT ON COLUMN attachments.ai_confidence IS 'AI analysis confidence score 0-1';

CREATE INDEX IF NOT EXISTS idx_attachments_parent 
  ON attachments (parent_type, parent_id);
